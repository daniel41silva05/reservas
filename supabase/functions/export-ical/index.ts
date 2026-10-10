// @ts-nocheck
// Supabase Edge Function: export-ical
// Serve o feed iCal para o Booking.com / Airbnb / Google Calendar ler
// URL: https://<project-ref>.supabase.co/functions/v1/export-ical?token=<token>

declare const Deno: any;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatICSDate(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function formatICSTimestamp(d = new Date()): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const seconds = String(d.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function escapeICS(str: string): string {
  return (str || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Token ausente.", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Procurar recurso pelo token
    const { data: recurso, error: recError } = await supabase
      .from("recursos")
      .select("id, nome, empresa_id")
      .eq("ical_export_token", token)
      .maybeSingle();

    if (recError || !recurso) {
      return new Response("Calendário não encontrado ou token inválido.", {
        status: 404,
        headers: corsHeaders,
      });
    }

    // 2. Procurar reservas confirmadas
    const { data: reservas, error: resError } = await supabase
      .from("reservas")
      .select("id, data_hora_inicio, data_hora_fim, status, cliente_nome")
      .eq("recurso_id", recurso.id)
      .eq("status", "confirmada");

    // 3. Procurar bloqueios manuais
    const { data: bloqueios, error: bloqError } = await supabase
      .from("bloqueios_disponibilidade")
      .select("id, data_hora_inicio, data_hora_fim, origem")
      .eq("recurso_id", recurso.id)
      .eq("origem", "manual");

    const nowTimestamp = formatICSTimestamp();
    const prodId = "-//Sistema de Reservas//PT";

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:${prodId}`,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeICS(recurso.nome)}`,
    ];

    // Adiciona Reservas Confirmadas
    if (reservas && reservas.length > 0) {
      for (const res of reservas) {
        const startDate = formatICSDate(res.data_hora_inicio);
        const endDate = formatICSDate(res.data_hora_fim);

        lines.push(
          "BEGIN:VEVENT",
          `UID:reserva-${res.id}@reservas`,
          `DTSTAMP:${nowTimestamp}`,
          `DTSTART;VALUE=DATE:${startDate}`,
          `DTEND;VALUE=DATE:${endDate}`,
          "SUMMARY:CLOSED - Not available",
          "STATUS:CONFIRMED",
          "END:VEVENT"
        );
      }
    }

    // Adiciona Bloqueios Manuais (Férias, Obras, etc.)
    if (bloqueios && bloqueios.length > 0) {
      for (const bloq of bloqueios) {
        const startDate = formatICSDate(bloq.data_hora_inicio);
        const endDate = formatICSDate(bloq.data_hora_fim);

        lines.push(
          "BEGIN:VEVENT",
          `UID:bloqueio-${bloq.id}@reservas`,
          `DTSTAMP:${nowTimestamp}`,
          `DTSTART;VALUE=DATE:${startDate}`,
          `DTEND;VALUE=DATE:${endDate}`,
          "SUMMARY:CLOSED - Not available",
          "STATUS:CONFIRMED",
          "END:VEVENT"
        );
      }
    }

    lines.push("END:VCALENDAR");

    const icsContent = lines.join("\r\n") + "\r\n";

    return new Response(icsContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="${encodeURIComponent(recurso.nome)}.ics"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: any) {
    return new Response(`Erro ao gerar calendário: ${err.message}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
