export async function renderNovaReservaWidget(container, session) {
    const empId = window.dashboardContext.currentEmpresaId;
    const isHotel = window.dashboardContext.currentEmpresaTipo &&
        window.dashboardContext.currentEmpresaTipo.toLowerCase() === 'hotel';
    const isExternalWidget = window.dashboardContext.isExternalWidget === true;

    if (!empId) {
        container.innerHTML = `<div class="glass-panel" style="padding: 2rem; text-align: center;"><p class="text-sub">Por favor, escolha ou crie uma empresa primeiro.</p></div>`;
        return;
    }

    // 1. Fetch available active resources
    const { data: recursos, error } = await window.supabase
        .from('recursos')
        .select('id, nome')
        .eq('empresa_id', empId)
        .eq('ativo', true);

    if (error) {
        container.innerHTML = `<div class="glass-panel" style="padding: 2rem; color: var(--danger);">Erro a carregar recursos: ${error.message}</div>`;
        return;
    }

    // Helper: generate time options (HH:MM) from 00:00 to 23:30 in 30 min steps
    function generateTimeOptions(selectedVal) {
        let opts = '';
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 30) {
                const hh = String(h).padStart(2, '0');
                const mm = String(m).padStart(2, '0');
                const val = `${hh}:${mm}`;
                opts += `<option value="${val}" ${val === selectedVal ? 'selected' : ''}>${val}</option>`;
            }
        }
        return opts;
    }

    // Helper: duration options for non-hotel
    function generateDurationOptions() {
        const opts = [
            { label: '15 minutos', val: 15 },
            { label: '30 minutos', val: 30 },
            { label: '45 minutos', val: 45 },
            { label: '1 hora', val: 60 },
            { label: '1h 30min', val: 90 },
            { label: '2 horas', val: 120 },
            { label: '2h 30min', val: 150 },
            { label: '3 horas', val: 180 },
            { label: '4 horas', val: 240 },
            { label: '5 horas', val: 300 },
            { label: '6 horas', val: 360 },
        ];
        return opts.map(o => `<option value="${o.val}">${o.label}</option>`).join('');
    }

    // 2. Build the UI
    let html = `
        <style>
            #nr-calendar-container .fc-col-header-cell {
                background-color: var(--surface-color) !important;
            }
            #nr-calendar-container .fc-col-header-cell-cushion {
                color: var(--text-main) !important;
            }
            @media (max-width: 768px) {
                #nr-calendar-container .fc-view-harness {
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                }
                #nr-calendar-container .fc-scrollgrid {
                    min-width: 600px !important;
                }
            }
        </style>
        <div class="glass-panel" style="padding: 1.5rem; width: 100%; margin: 0 auto;">
            <div style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                <h3>Nova Reserva</h3>
            </div>
            
            <div id="nr-alert" style="padding: 10px; border-radius: 4px; margin-bottom: 15px; display: none;"></div>

            <form id="nr-form">
                <!-- RECURSO -->
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>${isHotel ? 'Escolha o Alojamento' : 'Escolha o Serviço'}</label>
                    <input type="hidden" id="nr-recurso" required value="">
                    <div class="custom-dropdown" id="nr-recurso-dropdown" style="width: 100%;">
                        <div class="custom-dropdown-selected" tabindex="0" style="background: var(--surface-color); border: var(--glass-border, 1px solid var(--border-color)); border-radius: 12px; padding: 0.9rem 1.2rem; ${recursos && recursos.length > 0 ? '' : 'opacity: 0.5; pointer-events: none;'}">
                            <i class="fa-solid fa-cube icon-left"></i>
                            <span class="selected-text" id="nr-recurso-text">Selecione uma opção...</span>
                            <i class="fa-solid fa-chevron-down icon-arrow"></i>
                        </div>
                        <div class="custom-dropdown-menu">
                            ${recursos && recursos.length > 0
            ? recursos.map(r => `<div class="custom-option" data-value="${r.id}">${escapeHTML(r.nome)}</div>`).join('')
            : `<div class="custom-option disabled" style="cursor: default;">Nenhum recurso disponível/ativo.</div>`}
                        </div>
                    </div>
                </div>

                ${isHotel ? `
                <!-- HOTEL: Horas Check-in / Check-out -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div class="form-group">
                        <label><i class="fa-solid fa-right-to-bracket" style="color: var(--success); margin-right: 6px;"></i>Hora de Check-in</label>
                        <select id="nr-hora-checkin" class="form-control" style="cursor: pointer;">
                            <option value="">-- Selecione --</option>
                            ${generateTimeOptions('14:00')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label><i class="fa-solid fa-right-from-bracket" style="color: var(--danger); margin-right: 6px;"></i>Hora de Check-out</label>
                        <select id="nr-hora-checkout" class="form-control" style="cursor: pointer;">
                            <option value="">-- Selecione --</option>
                            ${generateTimeOptions('11:00')}
                        </select>
                    </div>
                </div>
                ` : `
                <!-- NÃO-HOTEL: Duração do Serviço -->
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label><i class="fa-solid fa-clock" style="color: var(--primary-color); margin-right: 6px;"></i>Duração do Serviço</label>
                    <select id="nr-duracao" class="form-control" style="cursor: pointer;">
                        ${generateDurationOptions()}
                    </select>
                </div>
                `}

                <!-- DATA(S) SELECIONADA(S) - exibição readonly -->
                <div style="display: grid; grid-template-columns: ${isHotel ? '1fr 1fr' : '1fr'}; gap: 1rem; margin-bottom: 1rem;">
                    <div class="form-group">
                        <label>${isHotel ? 'Data Check-in' : 'Data/Hora de Início'}</label>
                        <div style="position: relative; display: flex; align-items: center;">
                            <input type="text" id="nr-inicio" class="form-control" required readonly placeholder="Selecione no calendário">
                            <i class="fa-regular fa-calendar" style="position: absolute; right: 15px; color: var(--text-muted); pointer-events: none; font-size: 1.1rem;"></i>
                        </div>
                    </div>
                    ${isHotel ? `
                    <div class="form-group">
                        <label>Data Check-out</label>
                        <div style="position: relative; display: flex; align-items: center;">
                            <input type="text" id="nr-fim" class="form-control" required readonly placeholder="Selecione no calendário">
                            <i class="fa-regular fa-calendar" style="position: absolute; right: 15px; color: var(--text-muted); pointer-events: none; font-size: 1.1rem;"></i>
                        </div>
                    </div>
                    ` : `<input type="hidden" id="nr-fim" value="">`}
                </div>

                <!-- CALENDÁRIO -->
                <div class="form-group" style="margin-bottom: 1rem; position: relative;">
                    <div id="nr-calendar-container" style="background: var(--glass-bg); padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); min-height: 400px;"></div>
                </div>

                <!-- DADOS DO CLIENTE -->
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>Nome Cliente</label>
                    <input type="text" id="nr-nome" class="form-control" required>
                </div>
                
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>Email</label>
                    <input type="email" id="nr-email" class="form-control" required>
                </div>
                
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label>Telemóvel</label>
                    <input type="text" id="nr-telemovel" class="form-control" required>
                </div>

                ${isHotel ? `
                <div style="margin-bottom: 1.5rem;">
                    <div id="nr-price-display" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px; background: rgba(0,0,0,0.15);">
                        <span style="font-size: 1rem; font-weight: 500;">Preço Previsto (Auto):</span>
                        <strong id="nr-total-val" style="color: var(--warning); font-size: 1.1rem;">A aguardar datas...</strong>
                    </div>
                </div>
                ` : ''}

                <button type="submit" class="btn btn-primary" id="nr-submit-btn" style="width: 100%;"><i class="fa-solid fa-check"></i> Solicitar Reserva</button>
            </form>
        </div>

        <!-- Tooltip flutuante (hotel) -->
        <div id="nr-cal-tooltip" style="
            position: fixed;
            display: none;
            background: rgba(0,0,0,0.85);
            color: #fff;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 0.8rem;
            pointer-events: none;
            z-index: 9999;
            max-width: 260px;
            text-align: center;
            border: 1px solid rgba(255,255,255,0.15);
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        ">${isHotel ? 'Selecione o alojamento, hora de check-in e check-out primeiro' : 'Selecione primeiro o Serviço'}</div>
    `;

    container.innerHTML = html;

    setupWidgetListeners(empId, isHotel, isExternalWidget);
}

function setupWidgetListeners(empId, isHotel, isExternalWidget) {
    const form = document.getElementById('nr-form');
    const inputInicio = document.getElementById('nr-inicio');
    const inputFim = document.getElementById('nr-fim');
    const selectRecurso = document.getElementById('nr-recurso');
    const alertBox = document.getElementById('nr-alert');
    const tooltip = document.getElementById('nr-cal-tooltip');
    let precoCalculado = 0;

    let nrCalendar = null;
    window.currentResourcePrices = [];
    // Stores blocked date ranges for hotel mode: { start: Date, end: Date, isCheckoutFree: bool }
    window.nrBlockedRanges = [];
    // Stores recurring block rules: { dia_semana, hora_inicio, hora_fim }
    window.nrRecurringBlocks = [];
    // Style tag for non-hotel slot hiding
    let slotStyleEl = null;

    // ─── Tooltip logic (hotel only) ───────────────────────────────────────────
    function isCalendarReady() {
        if (!isHotel) {
            return !!selectRecurso.value;
        }
        const ci = document.getElementById('nr-hora-checkin')?.value;
        const co = document.getElementById('nr-hora-checkout')?.value;
        return !!(selectRecurso.value && ci && co);
    }

    // ─── Tooltip: show when calendar not ready (both hotel and non-hotel) ───────────
    const calContainer = document.getElementById('nr-calendar-container');
    calContainer.addEventListener('mousemove', (e) => {
        if (!isCalendarReady()) {
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 14) + 'px';
            tooltip.style.top = (e.clientY + 14) + 'px';
        } else {
            tooltip.style.display = 'none';
        }
    });
    calContainer.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });

    // ─── Check if a date (Date object, day granularity) is blocked for hotel ─
    function isDayBlockedForHotel(cellDate) {
        // cellDate is start of the day (midnight)
        const cellEnd = new Date(cellDate);
        cellEnd.setDate(cellEnd.getDate() + 1);
        const cellDateStr = cellDate.toISOString().split('T')[0];

        // 0. Check if past date
        if (isExternalWidget) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (cellDate < today) {
                return { blocked: true, isCheckout: false, reason: 'past' };
            }
        }

        // 1. Check recurring blocks — if the weekday is entirely blocked
        const dayOfWeek = cellDate.getDay();
        const hasFullRecurringBlock = (window.nrRecurringBlocks || []).some(b => {
            if (b.dia_semana !== dayOfWeek) return false;
            // If the recurring block covers the whole working day (or more), mark the day as blocked
            // For hotel: any recurring block on that weekday counts as the day being unavailable
            return true;
        });
        if (hasFullRecurringBlock) return { blocked: true, isCheckout: false };

        // 2. Check occasional blocks
        for (let b of (window.nrBlockedRanges || [])) {
            if (b.type !== 'bloqueio') continue;
            // If the block overlaps with this day
            if (cellDate < b.end && cellEnd > b.start) {
                return { blocked: true, isCheckout: false };
            }
        }

        // 3. Check reservas
        for (let b of (window.nrBlockedRanges || [])) {
            if (b.type !== 'reserva') continue;
            const reservaStart = b.start;
            const reservaEnd = b.end;
            // The check-out day is FREE: if cellDate equals the day of reservaEnd (start of that day)
            const reservaEndDay = new Date(reservaEnd.getFullYear(), reservaEnd.getMonth(), reservaEnd.getDate());
            const cellDateOnly = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());

            if (cellDateOnly.getTime() === reservaEndDay.getTime()) {
                // This is the checkout day - it is available
                continue;
            }
            // Otherwise check if day is inside the reservation
            if (cellDate < reservaEnd && cellEnd > reservaStart) {
                return { blocked: true, isCheckout: false };
            }
        }

        return { blocked: false };
    }

    // ─── Calendar initialization ───────────────────────────────────────────────
    function initCalendar() {
        const calEl = document.getElementById('nr-calendar-container');
        if (!calEl) return;

        if (isHotel) {
            // ── HOTEL: dayGridMonth ──────────────────────────────────────────
            nrCalendar = new window.FullCalendar.Calendar(calEl, {
                initialView: 'dayGridMonth',
                locale: 'pt',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth'
                },
                selectable: false,
                height: 'auto',

                // Render day cell content: number + price if available
                dayCellContent: function (arg) {
                    const text = arg.dayNumberText;
                    const cellDate = new Date(arg.date.getFullYear(), arg.date.getMonth(), arg.date.getDate());
                    const { blocked, reason } = isDayBlockedForHotel(cellDate);

                    if (blocked) {
                        if (reason === 'past') return { html: '' };
                        return { html: `<div class="fc-daygrid-day-number">${text}</div>` };
                    }

                    // Show price on available days
                    let foundPrice = null;
                    let defaultPrice = null;
                    for (let p of (window.currentResourcePrices || [])) {
                        if (!p.data_inicio && !p.data_fim) {
                            defaultPrice = parseFloat(p.preco_base);
                        } else if (p.data_inicio && p.data_fim) {
                            const pStart = new Date(p.data_inicio + 'T00:00:00');
                            const pEnd = new Date(p.data_fim + 'T23:59:59');
                            if (cellDate >= pStart && cellDate <= pEnd) {
                                foundPrice = parseFloat(p.preco_base);
                            }
                        }
                    }
                    const priceToShow = foundPrice !== null ? foundPrice : defaultPrice;

                    if (priceToShow !== null) {
                        return {
                            html: `<div class="fc-daygrid-day-number">${text}</div><div style="font-size: 0.78em; color: var(--success); text-align: center; margin-top: 2px; font-weight: bold;">${priceToShow}€/noite</div>`
                        };
                    }
                    return { html: `<div class="fc-daygrid-day-number">${text}</div>` };
                },

                // Apply blocked styling to cells after mount
                dayCellDidMount: function (arg) {
                    const cellDate = new Date(arg.date.getFullYear(), arg.date.getMonth(), arg.date.getDate());
                    const { blocked, reason } = isDayBlockedForHotel(cellDate);
                    if (blocked) {
                        arg.el.classList.add('nr-day-blocked');
                        arg.el.title = 'Indisponível';
                        // Overlay: diagonal stripe pattern + red tint
                        arg.el.style.cssText += [
                            'pointer-events: none !important;',
                            'background: repeating-linear-gradient(',
                            '  -45deg,',
                            '  rgba(239,68,68,0.10),',
                            '  rgba(239,68,68,0.10) 4px,',
                            '  rgba(239,68,68,0.03) 4px,',
                            '  rgba(239,68,68,0.03) 10px',
                            ') !important;',
                            'opacity: 0.55 !important;',
                        ].join('');
                        // Strikethrough the day number
                        const numEl = arg.el.querySelector('.fc-daygrid-day-number');
                        if (numEl) {
                            numEl.style.textDecoration = 'line-through';
                            numEl.style.color = 'rgba(239,68,68,0.7)';
                        }
                        // Add small unavailable badge
                        if (reason !== 'past') {
                            const badge = document.createElement('div');
                            badge.className = 'nr-blocked-badge';
                            badge.innerHTML = '<i class="fa-solid fa-ban"></i>';
                            arg.el.querySelector('.fc-daygrid-day-frame')?.appendChild(badge);
                        }
                    } else {
                        arg.el.style.cursor = 'pointer';
                        arg.el.classList.add('nr-day-available');
                    }
                },

                dateClick: function (info) {
                    if (!isCalendarReady()) {
                        showAlert('Por favor selecione o recurso, hora de check-in e hora de check-out antes de escolher datas.');
                        return;
                    }

                    const cellDate = new Date(info.date.getFullYear(), info.date.getMonth(), info.date.getDate());
                    const { blocked } = isDayBlockedForHotel(cellDate);
                    if (blocked) return;

                    hideAlert();

                    if (!window.nrHotelClickState || window.nrHotelClickState === 2) {
                        // First click = check-in day
                        window.nrHotelFirstDate = info.dateStr;
                        window.nrHotelClickState = 1;
                        inputInicio.value = info.dateStr;
                        inputFim.value = '';
                        // Highlight selection
                        nrCalendar.removeAllEvents();
                        nrCalendar.addEvent({
                            start: info.dateStr,
                            end: info.dateStr,
                            display: 'background',
                            color: 'rgba(99,102,241,0.35)'
                        });
                    } else if (window.nrHotelClickState === 1) {
                        // Second click = check-out day
                        let startStr = window.nrHotelFirstDate;
                        let endStr = info.dateStr;

                        if (new Date(startStr) > new Date(endStr)) {
                            [startStr, endStr] = [endStr, startStr];
                        }

                        if (startStr === endStr) {
                            showAlert('O check-out deve ser num dia diferente do check-in.');
                            return;
                        }

                        inputInicio.value = startStr;
                        inputFim.value = endStr;
                        window.nrHotelClickState = 2;

                        // Highlight full range
                        nrCalendar.removeAllEvents();
                        const endHighlight = new Date(endStr);
                        endHighlight.setDate(endHighlight.getDate() + 1);
                        nrCalendar.addEvent({
                            start: startStr,
                            end: endHighlight.toISOString().split('T')[0],
                            display: 'background',
                            color: 'rgba(99,102,241,0.35)'
                        });

                        btnCalc();
                    }
                }
            });

        } else {
            // ── NÃO-HOTEL: timeGridDay ───────────────────────────────────────
            // Compute initial slot duration from the dropdown
            const initialDurMin = parseInt(document.getElementById('nr-duracao')?.value) || 60;
            const initialSlotStr = durationToSlotStr(initialDurMin);

            nrCalendar = new window.FullCalendar.Calendar(calEl, {
                initialView: 'timeGridDay',
                locale: 'pt',
                validRange: isExternalWidget ? { start: (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })() } : undefined,
                slotLabelFormat: { hour: 'numeric', minute: '2-digit', omitZeroMinute: false, meridiem: false, separator: 'h' },
                eventTimeFormat: { hour: 'numeric', minute: '2-digit', omitZeroMinute: false, meridiem: false, separator: 'h' },
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: ''
                },
                selectable: true,
                selectMirror: true,
                unselectAuto: false,
                height: 'auto',
                selectOverlap: false,
                allDaySlot: false,
                slotDuration: initialSlotStr,
                snapDuration: initialSlotStr,
                selectLongPressDelay: 50,
                longPressDelay: 50,

                // Fix column header background via JS after render
                viewDidMount: function () {
                    const container = document.getElementById('nr-calendar-container');
                    if (!container) return;
                    container.querySelectorAll('.fc-col-header-cell, .fc-col-header, thead, thead td, thead th').forEach(el => {
                        el.style.setProperty('background', 'var(--surface-color)', 'important');
                        el.style.setProperty('background-color', 'var(--surface-color)', 'important');
                    });
                    container.querySelectorAll('.fc-col-header-cell-cushion').forEach(el => {
                        el.style.setProperty('color', 'var(--text-main, #e2e8f0)', 'important');
                        el.style.textDecoration = 'none';
                    });
                },

                // Control rendering for mirror (selection) and unavailable slot events
                eventContent: function (arg) {
                    const fmt = (d) => d
                        ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                        : '';

                    if (arg.isMirror) {
                        // Show clean "HH:MM – HH:MM" on the selection mirror
                        const start = arg.event.start;
                        const end = arg.event.end;
                        return {
                            html: `<div style="padding: 3px 6px; font-size: 0.8rem; font-weight: 600; color: #fff; line-height: 1.4;">${fmt(start)} – ${fmt(end)}</div>`
                        };
                    }

                    if (arg.event.classNames && arg.event.classNames.includes('nr-unavailable-slot')) {
                        // Unavailable slot: ban icon only, no text
                        return {
                            html: `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(239,68,68,0.7);font-size:0.75rem;pointer-events:none;"><i class="fa-solid fa-ban"></i></div>`
                        };
                    }

                    return true; // default for anything else
                },

                // Apply stripe background only to unavailable slots (not to mirror)
                eventDidMount: function (info) {
                    if (!info.event.classNames || !info.event.classNames.includes('nr-unavailable-slot')) return;
                    const el = info.el;
                    el.style.cursor = 'default';
                    el.style.pointerEvents = 'none';
                    el.style.background = 'repeating-linear-gradient(-45deg, rgba(239,68,68,0.22), rgba(239,68,68,0.22) 4px, rgba(239,68,68,0.06) 4px, rgba(239,68,68,0.06) 10px)';
                    el.style.borderColor = 'rgba(239,68,68,0.4)';
                    el.style.borderRadius = '4px';
                },


                selectAllow: function (selectInfo) {
                    if (!selectRecurso.value) return false;
                    return true;
                },

                dateClick: function (info) {
                    if (!selectRecurso.value) {
                        showAlert('Por favor selecione primeiro o Serviço.');
                        return;
                    }

                    hideAlert();

                    const durationMin = parseInt(document.getElementById('nr-duracao').value) || 60;
                    const startDate = new Date(info.date);
                    const endDate = new Date(startDate.getTime() + durationMin * 60 * 1000);

                    inputInicio.value = formatDateTimeLocal(startDate);
                    inputFim.value = endDate.toISOString();

                    if (nrCalendar) {
                        nrCalendar.select(startDate, endDate);
                    }
                },

                select: function (info) {
                    if (!selectRecurso.value) {
                        showAlert('Por favor selecione primeiro o Serviço.');
                        nrCalendar.unselect();
                        return;
                    }

                    hideAlert();

                    const durationMin = parseInt(document.getElementById('nr-duracao').value) || 60;
                    const startDate = new Date(info.start);

                    // Always use exactly the duration from dropdown, regardless of drag length
                    const endDate = new Date(startDate.getTime() + durationMin * 60 * 1000);

                    inputInicio.value = formatDateTimeLocal(startDate);
                    inputFim.value = endDate.toISOString();
                },

                // Recalculate hidden slots on date navigation
                datesSet: function (info) {
                    applyRecurringSlotHiding(info.start);
                }
            });
        }

        nrCalendar.render();

        if (!isHotel) {
            applyRecurringSlotHiding(new Date());
        }
    }

    // ─── Apply CSS hiding for recurring blocked slots (non-hotel) ─────────────
    function applyRecurringSlotHiding(currentViewDate) {
        if (slotStyleEl) {
            slotStyleEl.remove();
            slotStyleEl = null;
        }

        const blocks = window.nrRecurringBlocks || [];
        if (blocks.length === 0) return;

        const dayOfWeek = currentViewDate.getDay();
        const todayBlocks = blocks.filter(b => b.dia_semana === dayOfWeek);
        if (todayBlocks.length === 0) return;

        // Collect ALL time strings to hide (every 15-min granularity to cover all slot sizes)
        const hiddenTimes = new Set();
        todayBlocks.forEach(b => {
            const [startH, startM] = b.hora_inicio.split(':').map(Number);
            const [endH, endM] = b.hora_fim.split(':').map(Number);
            let cur = startH * 60 + startM;
            const endMin = endH * 60 + endM;
            while (cur < endMin) {
                const h = Math.floor(cur / 60);
                const m = cur % 60;
                hiddenTimes.add(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
                cur += 15; // 15-min granularity covers all possible slot sizes
            }
        });

        // Build a single clean CSS rule with all selectors joined by comma
        const slotSelectors = [];
        const labelSelectors = [];
        hiddenTimes.forEach(t => {
            slotSelectors.push(`.fc-timegrid-slot[data-time="${t}"]`);
            labelSelectors.push(`.fc-timegrid-slot-label[data-time="${t}"]`);
        });

        let css = '';
        if (slotSelectors.length) {
            css += slotSelectors.join(',\n') + ' { display: none !important; }\n';
        }
        if (labelSelectors.length) {
            css += labelSelectors.join(',\n') + ' { display: none !important; }\n';
        }

        slotStyleEl = document.createElement('style');
        slotStyleEl.id = 'nr-slot-hide-style';
        slotStyleEl.textContent = css;
        document.head.appendChild(slotStyleEl);
    }

    // ─── Load calendar events for a resource ──────────────────────────────────
    async function loadCalendarEvents(recursoId) {
        if (!recursoId || !nrCalendar) return;

        // Fetch reservas (pendente + confirmada only)
        const { data: reservas } = await window.supabase
            .from('reservas')
            .select('data_hora_inicio, data_hora_fim, status')
            .eq('recurso_id', recursoId)
            .in('status', ['pendente', 'confirmada']);

        // Fetch occasional blocks
        const { data: bloqueios } = await window.supabase
            .from('bloqueios_disponibilidade')
            .select('data_hora_inicio, data_hora_fim')
            .eq('recurso_id', recursoId);

        // Fetch recurring blocks
        const { data: bloqueiosRecorrentes } = await window.supabase
            .from('bloqueios_recorrentes')
            .select('dia_semana, hora_inicio, hora_fim')
            .eq('recurso_id', recursoId);

        // Fetch prices (hotel only)
        if (isHotel) {
            const { data: precos } = await window.supabase
                .from('precos')
                .select('preco_base, data_inicio, data_fim')
                .eq('recurso_id', recursoId);
            window.currentResourcePrices = precos || [];
        }

        // Store recurring blocks globally
        window.nrRecurringBlocks = bloqueiosRecorrentes || [];

        // Build blocked ranges for hotel day-cell logic
        window.nrBlockedRanges = [];

        if (reservas) {
            reservas.forEach(r => {
                window.nrBlockedRanges.push({
                    type: 'reserva',
                    start: new Date(r.data_hora_inicio),
                    end: new Date(r.data_hora_fim)
                });
            });
        }

        if (bloqueios) {
            bloqueios.forEach(b => {
                window.nrBlockedRanges.push({
                    type: 'bloqueio',
                    start: new Date(b.data_hora_inicio),
                    end: new Date(b.data_hora_fim)
                });
            });
        }

        // Reset selection state (hotel)
        window.nrHotelClickState = 0;
        inputInicio.value = '';
        inputFim.value = '';

        nrCalendar.removeAllEventSources();

        if (isHotel) {
            // dayCellDidMount only fires on cell mount, not on render().
            // Destroy and recreate so all cells mount fresh with the loaded blocked data.
            nrCalendar.destroy();
            nrCalendar = null;
            initCalendar();
        } else {
            // Non-hotel: show ALL unavailable slots as a single neutral "Indisponível"
            // WITHOUT revealing whether it's a reservation or a block
            let events = [];

            if (reservas) {
                reservas.forEach(r => {
                    events.push({
                        title: '',
                        start: r.data_hora_inicio,
                        end: r.data_hora_fim,
                        backgroundColor: 'transparent',
                        borderColor: 'transparent',
                        classNames: ['nr-unavailable-slot'],
                        overlap: false,
                        editable: false
                    });
                });
            }

            if (bloqueios) {
                bloqueios.forEach(b => {
                    events.push({
                        title: '',
                        start: b.data_hora_inicio,
                        end: b.data_hora_fim,
                        backgroundColor: 'transparent',
                        borderColor: 'transparent',
                        classNames: ['nr-unavailable-slot'],
                        overlap: false,
                        editable: false
                    });
                });
            }

            // Recurring blocks: hidden via CSS — NOT added as visible events
            nrCalendar.addEventSource(events);
            const currentDate = nrCalendar.getDate();
            applyRecurringSlotHiding(currentDate);
        }
    }

    // ─── Init calendar ─────────────────────────────────────────────────────────
    if (window.FullCalendar) {
        initCalendar();
    }

    // ─── Resource dropdown ──────────────────────────────────────────────────────
    const dropdown = document.getElementById('nr-recurso-dropdown');
    if (dropdown) {
        const selectedEl = dropdown.querySelector('.custom-dropdown-selected');
        const optionsList = dropdown.querySelectorAll('.custom-option:not(.disabled)');
        const textEl = dropdown.querySelector('.selected-text');

        selectedEl.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });

        document.addEventListener('click', () => {
            dropdown.classList.remove('open');
        });

        optionsList.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                optionsList.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                textEl.textContent = opt.textContent;
                dropdown.classList.remove('open');
                selectRecurso.value = opt.getAttribute('data-value');
                selectRecurso.dispatchEvent(new Event('change'));

                // Reset calendar state
                window.nrHotelClickState = 0;
                inputInicio.value = '';
                inputFim.value = '';
                if (nrCalendar) nrCalendar.removeAllEvents();

                loadCalendarEvents(opt.getAttribute('data-value'));
            });
        });
    }

    // ─── Hotel check-in/out hour changes trigger recalc ────────────────────────
    if (isHotel) {
        document.getElementById('nr-hora-checkin')?.addEventListener('change', () => {
            if (inputInicio.value && inputFim.value) btnCalc();
        });
        document.getElementById('nr-hora-checkout')?.addEventListener('change', () => {
            if (inputInicio.value && inputFim.value) btnCalc();
        });
    }

    // ─── Duration change for non-hotel ─────────────────────────────────────────
    if (!isHotel) {
        document.getElementById('nr-duracao')?.addEventListener('change', () => {
            const durationMin = parseInt(document.getElementById('nr-duracao').value) || 60;

            // Update calendar slot/snap duration to match selected service duration
            if (nrCalendar) {
                const slotStr = durationToSlotStr(durationMin);
                nrCalendar.setOption('slotDuration', slotStr);
                nrCalendar.setOption('snapDuration', slotStr);
            }

            // Recalculate end if a start was already selected
            if (inputInicio.value) {
                const startDate = new Date(inputInicio.value.replace(' ', 'T'));
                const endDate = new Date(startDate.getTime() + durationMin * 60 * 1000);
                inputFim.value = endDate.toISOString();
            }
        });
    }

    // ─── Alert helpers ─────────────────────────────────────────────────────────
    const showAlert = (msg, isError = true) => {
        alertBox.style.display = 'block';
        alertBox.style.background = isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)';
        alertBox.style.color = isError ? '#f87171' : '#4ade80';
        alertBox.style.border = isError ? '1px solid #ef4444' : '1px solid #22c55e';
        alertBox.textContent = msg;
    };
    const hideAlert = () => alertBox.style.display = 'none';

    // ─── Overlap checks ────────────────────────────────────────────────────────
    async function checkOverlaps(table, recursoId, startIso, endIso) {
        const selectStr = table === 'reservas' ? 'data_hora_inicio, data_hora_fim, status' : 'data_hora_inicio, data_hora_fim';
        const { data, error } = await window.supabase
            .from(table)
            .select(selectStr)
            .eq('recurso_id', recursoId);

        if (error || !data) return false;

        const start = new Date(startIso);
        const end = new Date(endIso);

        for (let idx = 0; idx < data.length; idx++) {
            if (table === 'reservas' && (data[idx].status === 'rejeitada' || data[idx].status === 'cancelada')) {
                continue;
            }
            const rowStart = new Date(data[idx].data_hora_inicio);
            const rowEnd = new Date(data[idx].data_hora_fim);
            if (start < rowEnd && end > rowStart) return true;
        }
        return false;
    }

    async function checkOverlapsRecorrentes(recursoId, startIso, endIso) {
        const { data, error } = await window.supabase
            .from('bloqueios_recorrentes')
            .select('dia_semana, hora_inicio, hora_fim')
            .eq('recurso_id', recursoId);

        if (error || !data || data.length === 0) return false;

        const start = new Date(startIso);
        const end = new Date(endIso);

        for (let cur = new Date(start); cur < end; cur.setDate(cur.getDate() + 1)) {
            const curDay = cur.getDay();
            for (let b of data) {
                if (b.dia_semana !== curDay) continue;
                const [hi, mi] = b.hora_inicio.split(':').map(Number);
                const [hf, mf] = b.hora_fim.split(':').map(Number);
                const blockStart = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), hi, mi, 0);
                const blockEnd = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), hf, mf, 0);
                if (start < blockEnd && end > blockStart) return true;
            }
        }
        return false;
    }

    // ─── Price calculation (hotel) ─────────────────────────────────────────────
    const btnCalc = async () => {
        if (!isHotel) return;

        const recursoId = selectRecurso.value;
        const dateInicio = inputInicio.value;
        const dateFim = inputFim.value;
        const horaCI = document.getElementById('nr-hora-checkin')?.value;
        const horaCO = document.getElementById('nr-hora-checkout')?.value;
        const msgEl = document.getElementById('nr-total-val');

        if (!recursoId || !dateInicio || !dateFim || !horaCI || !horaCO) {
            if (msgEl) { msgEl.textContent = 'A aguardar datas...'; msgEl.style.color = 'var(--warning)'; }
            precoCalculado = null;
            return;
        }

        const inicio = new Date(`${dateInicio}T${horaCI}:00`);
        const fim = new Date(`${dateFim}T${horaCO}:00`);

        if (inicio >= fim) {
            if (msgEl) { msgEl.textContent = 'Datas inválidas'; msgEl.style.color = 'var(--danger)'; }
            precoCalculado = null;
            return;
        }

        if (msgEl) { msgEl.textContent = 'A calcular...'; msgEl.style.color = 'var(--warning)'; }

        const { data: precosData, error } = await window.supabase
            .from('precos')
            .select('preco_base, data_inicio, data_fim')
            .eq('recurso_id', recursoId);

        if (error || !precosData || precosData.length === 0) {
            if (msgEl) { msgEl.textContent = 'Sem valor previsto nestas datas'; msgEl.style.color = 'var(--text-secondary)'; }
            precoCalculado = 0;
            return;
        }

        let total = 0;
        let missingPrice = false;
        let defaultPrice = null;

        for (let p of precosData) {
            if (!p.data_inicio && !p.data_fim) { defaultPrice = parseFloat(p.preco_base); break; }
        }

        let current = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
        const endDate = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());

        while (current < endDate) {
            let foundPrice = null;
            for (let p of precosData) {
                if (p.data_inicio && p.data_fim) {
                    const pStart = new Date(p.data_inicio + 'T00:00:00');
                    const pEnd = new Date(p.data_fim + 'T23:59:59');
                    if (current >= pStart && current <= pEnd) { foundPrice = parseFloat(p.preco_base); break; }
                }
            }
            if (foundPrice === null) {
                if (defaultPrice !== null) { total += defaultPrice; }
                else { missingPrice = true; break; }
            } else {
                total += foundPrice;
            }
            current.setDate(current.getDate() + 1);
        }

        if (missingPrice) {
            if (msgEl) { msgEl.textContent = 'Sem valor previsto nestas datas'; msgEl.style.color = 'var(--text-secondary)'; }
            precoCalculado = 0;
        } else {
            precoCalculado = total;
            if (msgEl) {
                msgEl.textContent = precoCalculado.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
                msgEl.style.color = 'var(--success)';
            }
        }
    };

    // ─── Form submission ────────────────────────────────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const recursoId = selectRecurso.value;
        const nome = document.getElementById('nr-nome').value;
        const email = document.getElementById('nr-email').value;
        const telemovel = document.getElementById('nr-telemovel').value;

        if (!recursoId) { showAlert('Por favor selecione o recurso.'); return; }

        let inicioISO, fimISO;

        if (isHotel) {
            const dateInicio = inputInicio.value;
            const dateFim = inputFim.value;
            const horaCI = document.getElementById('nr-hora-checkin')?.value;
            const horaCO = document.getElementById('nr-hora-checkout')?.value;

            if (!dateInicio || !dateFim || !horaCI || !horaCO) {
                showAlert('Por favor preencha todas as datas e horas de check-in/check-out.');
                return;
            }

            const inicioDate = new Date(`${dateInicio}T${horaCI}:00`);
            const fimDate = new Date(`${dateFim}T${horaCO}:00`);

            if (inicioDate >= fimDate) { showAlert('As datas fornecidas são inválidas.'); return; }

            inicioISO = inicioDate.toISOString();
            fimISO = fimDate.toISOString();

        } else {
            const startVal = inputInicio.value;
            const endVal = inputFim.value;

            if (!startVal || !endVal) { showAlert('Por favor selecione um horário no calendário.'); return; }

            inicioISO = new Date(startVal.replace(' ', 'T')).toISOString();
            fimISO = new Date(endVal).toISOString();

            if (new Date(inicioISO) >= new Date(fimISO)) { showAlert('As datas fornecidas são inválidas.'); return; }
        }

        const submitBtn = document.getElementById('nr-submit-btn');
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A Processar...';
        submitBtn.disabled = true;

        // Overlap validations
        const isRecBlocked = await checkOverlapsRecorrentes(recursoId, inicioISO, fimISO);
        if (isRecBlocked) {
            showAlert('Interseta com horário de fecho semanal rotineiro.');
            submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Solicitar Reserva';
            submitBtn.disabled = false;
            return;
        }

        const isBlocked = await checkOverlaps('bloqueios_disponibilidade', recursoId, inicioISO, fimISO);
        if (isBlocked) {
            showAlert('Período bloqueado. Não é possível reservar nestas datas.');
            submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Solicitar Reserva';
            submitBtn.disabled = false;
            return;
        }

        const isBooked = await checkOverlaps('reservas', recursoId, inicioISO, fimISO);
        if (isBooked) {
            showAlert('Já existe uma reserva pendente/confirmada neste intervalo.');
            submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Solicitar Reserva';
            submitBtn.disabled = false;
            return;
        }

        const payload = {
            empresa_id: empId,
            recurso_id: recursoId,
            cliente_nome: nome,
            cliente_email: email,
            cliente_telemovel: telemovel,
            data_hora_inicio: inicioISO,
            data_hora_fim: fimISO,
            preco_final: precoCalculado || 0,
            status: 'pendente'
        };

        const { error: insertError } = await window.supabase.from('reservas').insert([payload]);

        submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Solicitar Reserva';
        submitBtn.disabled = false;

        if (insertError) {
            showAlert('Erro ao inserir: ' + insertError.message);
        } else {
            form.innerHTML = `
                <div style="text-align: center; padding: 2rem 0;">
                    <i class="fa-solid fa-circle-check" style="font-size: 3rem; color: var(--success); margin-bottom: 1rem;"></i>
                    <h4>Reserva Submetida!</h4>
                    <p class="text-sub">Ficará pendente nos registos para revisão.</p>
                    ${!isExternalWidget ? '<button class="btn btn-primary" onclick="document.querySelector(\'[data-view=\\\'reservas\\\']\').click()" style="margin-top: 1.5rem;">Ver Reservas</button>' : ''}
                </div>
            `;
        }
    });
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
function formatDateTimeLocal(date) {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${d} ${h}:${mi}`;
}

function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Convert minutes to FullCalendar duration string "HH:MM:SS"
function durationToSlotStr(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

