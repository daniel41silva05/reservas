// js/services/ical-service.js
// Serviço para sincronização e gestão de calendários iCal (Booking.com / Airbnb)

// Converte string de data iCal (ex: 20261017 ou 20261017T140000Z) para ISO
export function parseICSDate(dateStr, isEnd = false) {
    if (!dateStr) return null;
    const clean = dateStr.trim();

    // Formato simples de data YYYYMMDD (Booking.com padrão)
    if (/^\d{8}$/.test(clean)) {
        const year = clean.substring(0, 4);
        const month = clean.substring(4, 6);
        const day = clean.substring(6, 8);
        // Hotel: check-in às 14:00Z, check-out às 11:00Z
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

// Analisador leve de ficheiros .ics
export function parseICS(icsText, defaultSummary = "Reservado") {
    const events = [];
    const lines = icsText.split(/\r\n|\n|\r/);
    let inEvent = false;
    let currentUid = "";
    let currentStart = "";
    let currentEnd = "";
    let currentSummary = "";

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Linhas de continuação (começam por espaço ou tab)
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
                        summary: currentSummary || defaultSummary
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

// Gera a URL do feed de exportação iCal para colar no Booking ou Airbnb
export function getExportIcalUrl(token) {
    if (!token) return '';
    const supabaseUrl = (window.ENV && window.ENV.SUPABASE_URL) ? window.ENV.SUPABASE_URL : 'https://pvwuubqqkcpqswhravpa.supabase.co';
    return `${supabaseUrl}/functions/v1/export-ical?token=${token}`;
}

// Sincroniza um recurso específico a partir do Booking
export async function syncRecursoBooking(recursoId) {
    if (!recursoId) throw new Error("ID do recurso em falta.");

    // 1. Tentar chamar a Supabase Edge Function primeiro
    try {
        if (window.supabase.functions) {
            const { data, error } = await window.supabase.functions.invoke('sync-booking', {
                body: { recurso_id: recursoId }
            });

            if (!error && data && data.success) {
                return {
                    success: true,
                    via: 'edge-function',
                    report: data.report || []
                };
            }
        }
    } catch (edgeErr) {
        console.warn("Edge Function não disponível ou falhou, a usar fallback de cliente:", edgeErr);
    }

    // 2. Fallback de cliente: lê diretamente do Supabase e faz fetch via proxy CORS se necessário
    const { data: rec, error: recError } = await window.supabase
        .from('recursos')
        .select('id, empresa_id, nome, ical_import_url')
        .eq('id', recursoId)
        .single();

    if (recError || !rec) {
        throw new Error("Recurso não encontrado: " + (recError?.message || ""));
    }

    if (!rec.ical_import_url) {
        throw new Error("Este recurso não tem nenhum link do Booking configurado.");
    }

    let icsText = '';

    // Tenta fetch direto ou com fallback de proxy CORS
    try {
        const resDirect = await fetch(rec.ical_import_url);
        if (resDirect.ok) {
            icsText = await resDirect.text();
        }
    } catch (_) {
        // Tenta via proxy CORS para evitar bloqueio de browser
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rec.ical_import_url)}`;
        const resProxy = await fetch(proxyUrl);
        if (!resProxy.ok) {
            throw new Error(`Falha ao descarregar o iCal do Booking (Código ${resProxy.status}).`);
        }
        icsText = await resProxy.text();
    }

    if (!icsText || !icsText.includes('BEGIN:VCALENDAR')) {
        throw new Error("O ficheiro retornado pelo link não é um calendário iCal válido.");
    }

    const events = parseICS(icsText);

    // Obter bloqueios já existentes com origem 'booking'
    const { data: existingBlocks } = await window.supabase
        .from('bloqueios_disponibilidade')
        .select('id, external_uid')
        .eq('recurso_id', rec.id)
        .eq('origem', 'booking');

    const existingMap = new Map((existingBlocks || []).map(b => [b.external_uid, b.id]));
    const currentUids = new Set(events.map(e => e.uid));

    // Remover bloqueios que foram cancelados no Booking
    const toDeleteIds = [];
    for (const [uid, id] of existingMap.entries()) {
        if (!currentUids.has(uid)) {
            toDeleteIds.push(id);
        }
    }

    if (toDeleteIds.length > 0) {
        await window.supabase
            .from('bloqueios_disponibilidade')
            .delete()
            .in('id', toDeleteIds);
    }

    // Inserir ou atualizar bloqueios
    let inserted = 0;
    let updated = 0;

    for (const ev of events) {
        const payload = {
            empresa_id: rec.empresa_id,
            recurso_id: rec.id,
            data_hora_inicio: ev.startDate,
            data_hora_fim: ev.endDate,
            origem: 'booking',
            external_uid: ev.uid
        };

        if (existingMap.has(ev.uid)) {
            await window.supabase
                .from('bloqueios_disponibilidade')
                .update(payload)
                .eq('id', existingMap.get(ev.uid));
            updated++;
        } else {
            await window.supabase
                .from('bloqueios_disponibilidade')
                .insert([payload]);
            inserted++;
        }
    }

    const nowIso = new Date().toISOString();
    await window.supabase
        .from('recursos')
        .update({ ical_last_sync: nowIso })
        .eq('id', rec.id);

    return {
        success: true,
        via: 'client-fallback',
        eventsCount: events.length,
        inserted,
        updated,
        deleted: toDeleteIds.length,
        last_sync: nowIso
    };
}

// Sincroniza um recurso específico a partir do Airbnb
export async function syncRecursoAirbnb(recursoId) {
    if (!recursoId) throw new Error("ID do recurso em falta.");

    // 1. Tentar chamar a Supabase Edge Function primeiro
    try {
        if (window.supabase.functions) {
            const { data, error } = await window.supabase.functions.invoke('sync-airbnb', {
                body: { recurso_id: recursoId }
            });

            if (!error && data && data.success) {
                return {
                    success: true,
                    via: 'edge-function',
                    report: data.report || []
                };
            }
        }
    } catch (edgeErr) {
        console.warn("Edge Function sync-airbnb não disponível ou falhou, a usar fallback de cliente:", edgeErr);
    }

    // 2. Fallback de cliente: lê diretamente do Supabase e faz fetch via proxy CORS se necessário
    const { data: rec, error: recError } = await window.supabase
        .from('recursos')
        .select('id, empresa_id, nome, ical_airbnb_url')
        .eq('id', recursoId)
        .single();

    if (recError || !rec) {
        throw new Error("Recurso não encontrado: " + (recError?.message || ""));
    }

    if (!rec.ical_airbnb_url) {
        throw new Error("Este recurso não tem nenhum link do Airbnb configurado.");
    }

    let icsText = '';

    // Tenta fetch direto ou com fallback de proxy CORS
    try {
        const resDirect = await fetch(rec.ical_airbnb_url);
        if (resDirect.ok) {
            icsText = await resDirect.text();
        }
    } catch (_) {
        // Tenta via proxy CORS para evitar bloqueio de browser
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rec.ical_airbnb_url)}`;
        const resProxy = await fetch(proxyUrl);
        if (!resProxy.ok) {
            throw new Error(`Falha ao descarregar o iCal do Airbnb (Código ${resProxy.status}).`);
        }
        icsText = await resProxy.text();
    }

    if (!icsText || !icsText.includes('BEGIN:VCALENDAR')) {
        throw new Error("O ficheiro retornado pelo link não é um calendário iCal válido.");
    }

    const events = parseICS(icsText, "Reservado (Airbnb)");

    // Obter bloqueios já existentes com origem 'airbnb'
    const { data: existingBlocks } = await window.supabase
        .from('bloqueios_disponibilidade')
        .select('id, external_uid')
        .eq('recurso_id', rec.id)
        .eq('origem', 'airbnb');

    const existingMap = new Map((existingBlocks || []).map(b => [b.external_uid, b.id]));
    const currentUids = new Set(events.map(e => e.uid));

    // Remover bloqueios que foram cancelados no Airbnb
    const toDeleteIds = [];
    for (const [uid, id] of existingMap.entries()) {
        if (!currentUids.has(uid)) {
            toDeleteIds.push(id);
        }
    }

    if (toDeleteIds.length > 0) {
        await window.supabase
            .from('bloqueios_disponibilidade')
            .delete()
            .in('id', toDeleteIds);
    }

    // Inserir ou atualizar bloqueios
    let inserted = 0;
    let updated = 0;

    for (const ev of events) {
        const payload = {
            empresa_id: rec.empresa_id,
            recurso_id: rec.id,
            data_hora_inicio: ev.startDate,
            data_hora_fim: ev.endDate,
            origem: 'airbnb',
            external_uid: ev.uid
        };

        if (existingMap.has(ev.uid)) {
            await window.supabase
                .from('bloqueios_disponibilidade')
                .update(payload)
                .eq('id', existingMap.get(ev.uid));
            updated++;
        } else {
            await window.supabase
                .from('bloqueios_disponibilidade')
                .insert([payload]);
            inserted++;
        }
    }

    const nowIso = new Date().toISOString();
    await window.supabase
        .from('recursos')
        .update({ ical_airbnb_last_sync: nowIso })
        .eq('id', rec.id);

    return {
        success: true,
        via: 'client-fallback',
        eventsCount: events.length,
        inserted,
        updated,
        deleted: toDeleteIds.length,
        last_sync: nowIso
    };
}

// Sincroniza todos os canais configurados (Booking e Airbnb) de um recurso
export async function syncRecursoAll(recursoId) {
    const results = { booking: null, airbnb: null };
    try {
        results.booking = await syncRecursoBooking(recursoId);
    } catch (e) {
        results.bookingError = e.message;
    }
    try {
        results.airbnb = await syncRecursoAirbnb(recursoId);
    } catch (e) {
        results.airbnbError = e.message;
    }
    return results;
}

