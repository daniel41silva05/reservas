// Supabase Edge Function: sync-airbnb
// Sincroniza os calendários do Airbnb para o Teu Sistema
// Pode ser chamada manualmente pelo Dashboard ("Sincronizar Airbnb")
// ou automaticamente à meia-noite pelo Cron do Supabase.

// @ts-nocheck
declare const Deno: any;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ICSEvent {
  uid: string;
  startDate: string; // ISO
  endDate: string;   // ISO
  summary: string;
}

// Converte string de data iCal (ex: 20261023 ou 20261023T140000Z) para ISO
function parseICSDate(dateStr: string, isEnd = false): string | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();

  // Formato simples YYYYMMDD (padrão de datas no Airbnb iCal)
  if (/^\d{8}$/.test(clean)) {
    const year = clean.substring(0, 4);
    const month = clean.substring(4, 6);
    const day = clean.substring(6, 8);
    // Para alojamento/hotel: check-in às 14:00Z, check-out às 11:00Z
    const time = isEnd ? "11:00:00Z" : "14:00:00Z";
    return `${year}-${month}-${day}T${time}`;
  }

  // Formato UTC YYYYMMDDTHHMMSSZ
  const matchUtc = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (matchUtc) {
    const [, y, m, d, h, min, s] = matchUtc;
    return `${y}-${m}-${d}T${h}:${min}:${s}Z`;
  }

  const parsed = new Date(clean);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// Analisador leve de iCal
function parseICS(icsText: string): ICSEvent[] {
  const events: ICSEvent[] = [];
  const lines = icsText.split(/\r\n|\n|\r/);
  let inEvent = false;
  let currentUid = "";
  let currentStart = "";
  let currentEnd = "";
  let currentSummary = "";

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Trata continuação de linha iCal (linhas que começam por espaço ou tab)
    while (i + 1 < lines.length && (lines[i + 1].startsWith(" ") || lines[i + 1].startsWith("\t"))) {
      line += lines[i + 1].substring(1);
      i++;
    }

    line = line.trim();

    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      currentUid = "";
      currentStart = "";
      currentEnd = "";
      currentSummary = "";
      continue;
    }

    if (line === "END:VEVENT") {
      if (inEvent && currentUid && currentStart && currentEnd) {
        const startDate = parseICSDate(currentStart, false);
        const endDate = parseICSDate(currentEnd, true);
        if (startDate && endDate) {
          events.push({
            uid: currentUid,
            startDate,
            endDate,
            summary: currentSummary || "Reservado (Airbnb)",
          });
        }
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) continue;

    if (line.startsWith("UID:")) {
      currentUid = line.substring(4).trim();
    } else if (line.startsWith("DTSTART")) {
      const parts = line.split(":");
      currentStart = parts.slice(1).join(":");
    } else if (line.startsWith("DTEND")) {
      const parts = line.split(":");
      currentEnd = parts.slice(1).join(":");
    } else if (line.startsWith("SUMMARY:")) {
      currentSummary = line.substring(8).trim();
    }
  }

  return events;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let recursoId: string | null = null;
    let empresaId: string | null = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        recursoId = body.recurso_id || null;
        empresaId = body.empresa_id || null;
      } catch (_) {}
    } else {
      const url = new URL(req.url);
      recursoId = url.searchParams.get("recurso_id");
      empresaId = url.searchParams.get("empresa_id");
    }

    // 1. Procurar recursos com ical_airbnb_url configurado
    let query = supabase
      .from("recursos")
      .select("id, empresa_id, nome, ical_airbnb_url")
      .not("ical_airbnb_url", "is", null);

    if (recursoId) {
      query = query.eq("id", recursoId);
    } else if (empresaId) {
      query = query.eq("empresa_id", empresaId);
    }

    const { data: recursos, error: recError } = await query;

    if (recError) {
      throw new Error(`Erro ao obter recursos: ${recError.message}`);
    }

    if (!recursos || recursos.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum recurso com iCal do Airbnb configurado encontrado.", synced: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const syncReport = [];

    // 2. Processar cada recurso
    for (const rec of recursos) {
      try {
        const res = await fetch(rec.ical_airbnb_url, {
          headers: {
            "User-Agent": "Reservas-Sync/1.0 (Mozilla/5.0 compatible)",
            "Accept": "text/calendar, text/plain, */*",
          },
        });

        if (!res.ok) {
          throw new Error(`Airbnb respondeu com status ${res.status}: ${res.statusText}`);
        }

        const icsText = await res.text();
        const events = parseICS(icsText);

        // Obter bloqueios já existentes com origem 'airbnb' para este recurso
        const { data: existingBlocks } = await supabase
          .from("bloqueios_disponibilidade")
          .select("id, external_uid")
          .eq("recurso_id", rec.id)
          .eq("origem", "airbnb");

        const existingMap = new Map((existingBlocks || []).map((b) => [b.external_uid, b.id]));
        const currentUids = new Set(events.map((e) => e.uid));

        // Remover bloqueios que deixaram de existir no Airbnb (cancelados)
        const toDeleteIds: string[] = [];
        for (const [uid, id] of existingMap.entries()) {
          if (!currentUids.has(uid)) {
            toDeleteIds.push(id);
          }
        }

        if (toDeleteIds.length > 0) {
          await supabase.from("bloqueios_disponibilidade").delete().in("id", toDeleteIds);
        }

        // Inserir ou atualizar bloqueios do feed
        let insertedCount = 0;
        let updatedCount = 0;

        for (const event of events) {
          const payload = {
            empresa_id: rec.empresa_id,
            recurso_id: rec.id,
            data_hora_inicio: event.startDate,
            data_hora_fim: event.endDate,
            origem: "airbnb",
            external_uid: event.uid,
          };

          if (existingMap.has(event.uid)) {
            await supabase
              .from("bloqueios_disponibilidade")
              .update(payload)
              .eq("id", existingMap.get(event.uid));
            updatedCount++;
          } else {
            await supabase.from("bloqueios_disponibilidade").insert([payload]);
            insertedCount++;
          }
        }

        // Atualizar timestamp da última sincronização do Airbnb
        const nowIso = new Date().toISOString();
        await supabase
          .from("recursos")
          .update({ ical_airbnb_last_sync: nowIso })
          .eq("id", rec.id);

        syncReport.push({
          recurso_id: rec.id,
          recurso_nome: rec.nome,
          success: true,
          eventsFound: events.length,
          inserted: insertedCount,
          updated: updatedCount,
          deleted: toDeleteIds.length,
          last_sync: nowIso,
        });
      } catch (err: any) {
        syncReport.push({
          recurso_id: rec.id,
          recurso_nome: rec.nome,
          success: false,
          error: err.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        resourcesProcessed: recursos.length,
        report: syncReport,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
