export async function renderReservas(container, session) {
    const empId = window.dashboardContext.currentEmpresaId;

    if (!empId) {
        container.innerHTML = `<div class="glass-panel" style="padding: 2rem; text-align: center;"><p class="text-sub">Por favor, escolha ou crie uma empresa primeiro.</p></div>`;
        return;
    }

    // Load Data
    const { data: recursos } = await window.supabase
        .from('recursos')
        .select('id, nome')
        .eq('empresa_id', empId)
        .eq('ativo', true);

    const { data: reservas, error } = await window.supabase
        .from('reservas')
        .select(`*, recursos(nome)`)
        .eq('empresa_id', empId)
        .order('data_hora_inicio', { ascending: false });

    if (error) {
        container.innerHTML = `<div class="glass-panel" style="padding: 2rem; color: var(--danger);">Erro a carregar reservas: ${error.message}</div>`;
        return;
    }

    // Build Overview
    const countPendentes = reservas ? reservas.filter(r => r.status === 'pendente').length : 0;
    const countConfirmadas = reservas ? reservas.filter(r => r.status === 'confirmada').length : 0;

    let html = `
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <h3>Reservas e Marcações</h3>
                    <p class="text-sub" style="font-size: 0.85rem;">Gerir o status e visualizar ocupação no calendário.</p>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <div style="display: flex; background: rgba(255, 255, 255, 0.1); border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color);">
                        <button id="btnViewList" class="btn" style="border-radius: 0; background: var(--primary-color); color: #fff; border: none; padding: 0.5rem 1rem;">Lista</button>
                        <button id="btnViewCalendar" class="btn" style="border-radius: 0; background: transparent; color: var(--text-main); border: none; padding: 0.5rem 1rem;">Calendário</button>
                    </div>
                </div>
            </div>

            <div id="reservasOverview" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--warning);">
                    <h5 style="color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase; font-size: 0.75rem;">Pendentes</h5>
                    <div id="overviewPendentes" style="font-size: 1.5rem; font-weight: 700;">${countPendentes}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--success);">
                    <h5 style="color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase; font-size: 0.75rem;">Confirmadas</h5>
                    <div id="overviewConfirmadas" style="font-size: 1.5rem; font-weight: 700;">${countConfirmadas}</div>
                </div>
            </div>

            <!-- FILTERS TOGGLE BUTTON -->
            <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
                <button id="btnToggleFilters" class="btn btn-secondary" style="font-size: 0.85rem; padding: 0.5rem 1rem;">
                    <i class="fa-solid fa-filter"></i> Mostrar Filtros
                </button>
            </div>

            <!-- FILTERS CONTAINER -->
            <div id="filtersContainer" class="hidden" style="background: rgba(0,0,0,0.15); padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid rgba(255,255,255,0.05);">
                <h5 style="margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-secondary);">Filtros de Pesquisa</h5>
                <!-- Row 1 -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                    <div class="form-group mb-0">
                        <label style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; display: block;">Cliente/Contacto</label>
                        <input type="text" id="filterCliente" class="form-control" placeholder="Buscar..." style="padding: 0.75rem 1rem;">
                    </div>
                    <div class="form-group mb-0" style="display: flex; flex-direction: column;">
                        <label style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; display: block;">Recurso</label>
                        <input type="hidden" id="filterRecurso" value="">
                        <div class="custom-dropdown" id="filterRecursoDropdown" style="width: 100%;">
                            <div class="custom-dropdown-selected" tabindex="0" style="padding: 0.75rem 1rem;">
                                <i class="fa-solid fa-cube icon-left"></i>
                                <span class="selected-text">Todos os Recursos</span>
                                <i class="fa-solid fa-chevron-down icon-arrow"></i>
                            </div>
                            <div class="custom-dropdown-menu">
                                <div class="custom-option active" data-value="">Todos os Recursos</div>
                                ${recursos ? recursos.map(r => `<div class="custom-option" data-value="${escapeHTML(r.nome)}">${escapeHTML(r.nome)}</div>`).join('') : ''}
                            </div>
                        </div>
                    </div>
                    <div class="form-group mb-0" style="display: flex; flex-direction: column;">
                        <label style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; display: block;">Estado</label>
                        <input type="hidden" id="filterEstado" value="">
                        <div class="custom-dropdown" id="filterEstadoDropdown" style="width: 100%;">
                            <div class="custom-dropdown-selected" tabindex="0" style="padding: 0.75rem 1rem;">
                                <i class="fa-solid fa-circle-half-stroke icon-left"></i>
                                <span class="selected-text">Todos os Estados</span>
                                <i class="fa-solid fa-chevron-down icon-arrow"></i>
                            </div>
                            <div class="custom-dropdown-menu">
                                <div class="custom-option active" data-value="">Todos os Estados</div>
                                <div class="custom-option" data-value="pendente">Pendente</div>
                                <div class="custom-option" data-value="confirmada">Confirmada</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Row 2 -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; align-items: end;">
                    <div class="form-group mb-0">
                        <label style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; display: block;">De</label>
                        <div style="position: relative; display: flex; align-items: center;">
                            <input type="text" id="filterDataInicio" class="form-control" placeholder="Selecione data limite" style="padding: 0.75rem 1rem;">
                            <i class="fa-regular fa-calendar" style="position: absolute; right: 15px; color: var(--text-muted); pointer-events: none; font-size: 1.1rem;"></i>
                        </div>
                    </div>
                    <div class="form-group mb-0">
                        <label style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; display: block;">Até</label>
                        <div style="position: relative; display: flex; align-items: center;">
                            <input type="text" id="filterDataFim" class="form-control" placeholder="Selecione data limite" style="padding: 0.75rem 1rem;">
                            <i class="fa-regular fa-calendar" style="position: absolute; right: 15px; color: var(--text-muted); pointer-events: none; font-size: 1.1rem;"></i>
                        </div>
                    </div>
                    <div class="form-group mb-0" style="display: flex;">
                        <button type="button" id="btnLimparFiltros" class="btn btn-secondary" style="width: 100%; padding: 0.75rem 1rem;"><i class="fa-solid fa-eraser"></i> Limpar Filtros</button>
                    </div>
                </div>
            </div>

            <div id="formContainerReserva" class="hidden" style="margin-bottom: 2rem; padding: 1.5rem; border: 1px solid var(--border-color); border-radius: 8px; background: rgba(0,0,0,0.2);">
                <h4 style="margin-bottom: 1rem;">Editar Reserva</h4>
                <form id="formEditReserva">
                    <input type="hidden" id="editReservaId" value="">
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div class="form-group">
                            <label>Nome Cliente</label>
                            <input type="text" id="editResNome" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" id="editResEmail" class="form-control" required>
                        </div>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <div class="form-group">
                            <label>Telemóvel</label>
                            <input type="text" id="editResTelemovel" class="form-control" required>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div class="form-group">
                            <label>Início (Data e Hora)</label>
                            <div style="position: relative; display: flex; align-items: center;">
                                <input type="text" id="editResInicio" class="form-control" placeholder="Selecione data e hora iniciais" required>
                                <i class="fa-regular fa-calendar" style="position: absolute; right: 15px; color: var(--text-muted); pointer-events: none; font-size: 1.1rem;"></i>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Fim (Data e Hora)</label>
                            <div style="position: relative; display: flex; align-items: center;">
                                <input type="text" id="editResFim" class="form-control" placeholder="Selecione data e hora finais" required>
                                <i class="fa-regular fa-calendar" style="position: absolute; right: 15px; color: var(--text-muted); pointer-events: none; font-size: 1.1rem;"></i>
                            </div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div class="form-group">
                            <label>Preço Final (€)</label>
                            <input type="number" step="0.01" id="editResPreco" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>Estado</label>
                            <input type="hidden" id="editResStatus" value="">
                            <div class="custom-dropdown" id="editResStatusDropdown" style="width: 100%;">
                                <div class="custom-dropdown-selected" tabindex="0" style="padding: 0.9rem 1.2rem;">
                                    <i class="fa-solid fa-circle-half-stroke icon-left"></i>
                                    <span class="selected-text">Selecione o estado...</span>
                                    <i class="fa-solid fa-chevron-down icon-arrow"></i>
                                </div>
                                <div class="custom-dropdown-menu">
                                    <div class="custom-option" data-value="pendente">Pendente</div>
                                    <div class="custom-option" data-value="confirmada">Confirmada</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" id="btnCancelarEditReserva">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btnSalvarEditReserva">Salvar Alterações</button>
                    </div>
                </form>
            </div>

            <!-- LIST VIEW -->
            <div id="viewListContainer" class="data-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Recurso</th>
                            <th>Cliente</th>
                            <th>Data Reservada</th>
                            <th>Total</th>
                            <th>Estado</th>
                            <th style="text-align: right;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    const formataDataHora = (isoStr) => {
        const d = new Date(isoStr);
        return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getStatusBadge = (status) => {
        if (status === 'confirmada') return '<span class="badge badge-success">Confirmada</span>';
        if (status === 'rejeitada' || status === 'cancelada') return '<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171;">Rejeitada</span>';
        return '<span class="badge badge-warning">Pendente</span>';
    };

    if (reservas && reservas.length > 0) {
        reservas.forEach(res => {
            const recursoNome = res.recursos ? res.recursos.nome : 'N/A';
            const formatForInput = (d) => {
                const off = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                return off.replace('T', ' ');
            };

            html += `
                <tr class="reserva-row" data-cliente="${escapeHTML(res.cliente_nome)} ${escapeHTML(res.cliente_email)} ${escapeHTML(res.cliente_telemovel)}" data-recurso="${escapeHTML(recursoNome)}" data-estado="${res.status}" data-inicio="${res.data_hora_inicio}" style="${res.status === 'pendente' ? 'background: rgba(245, 158, 11, 0.05);' : ''}">
                    <td><strong>${escapeHTML(recursoNome)}</strong></td>
                    <td>${escapeHTML(res.cliente_nome)}<br><small class="text-sub">${escapeHTML(res.cliente_email)} | ${escapeHTML(res.cliente_telemovel)}</small></td>
                    <td style="font-size: 0.85rem;">${formataDataHora(res.data_hora_inicio)}<br><span style="color: var(--text-secondary);">até</span> ${formataDataHora(res.data_hora_fim)}</td>
                    <td><strong>${(res.preco_final && parseFloat(res.preco_final) > 0) ? parseFloat(res.preco_final).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }) : '<span class="text-sub">--</span>'}</strong></td>
                    <td>${getStatusBadge(res.status)}</td>
                    <td style="text-align: right;">
                        <div style="display: inline-flex; gap: 0.5rem; align-items: center; white-space: nowrap;">
                            <button class="btn btn-secondary btn-edit-reserva" 
                            data-id="${res.id}" 
                            data-nome="${escapeHTML(res.cliente_nome)}" 
                            data-email="${escapeHTML(res.cliente_email)}" 
                            data-telemovel="${escapeHTML(res.cliente_telemovel)}" 
                            data-inicio="${formatForInput(new Date(res.data_hora_inicio))}"
                            data-fim="${formatForInput(new Date(res.data_hora_fim))}"
                            data-preco="${parseFloat(res.preco_final) > 0 ? res.preco_final : ''}"
                            data-status="${res.status}"
                            style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto;" title="Editar"><i class="fa-solid fa-pen"></i></button>
                        ${res.status === 'pendente' ? `
                            <button class="btn btn-primary btn-action-reserva" data-id="${res.id}" data-action="confirmada" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto; background: var(--success);" title="Confirmar"><i class="fa-solid fa-check"></i></button>
                            <button class="btn btn-secondary btn-delete-reserva" data-id="${res.id}" title="Apagar Ocorrência" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto; color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
                        ` : `
                            <button class="btn btn-secondary btn-action-reserva" data-id="${res.id}" data-action="pendente" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto; color: var(--warning);" title="Reverter para Pendente"><i class="fa-solid fa-clock"></i></button>
                            <button class="btn btn-secondary btn-delete-reserva" data-id="${res.id}" title="Apagar Ocorrência" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto; color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
                        `}
                        </div>
                    </td>
                </tr>
            `;
        });
    } else {
        html += `<tr><td colspan="6">Ainda não há reservas registadas.</td></tr>`;
    }

    html += `
                    </tbody>
                </table>
            </div>

            <!-- CALENDAR VIEW -->
            <div id="viewCalendarContainer" style="display: none; min-height: 600px; color: #fff;">
                <div id="calendarEl" style="height: 100%;"></div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // View Switcher logic
    const btnList = document.getElementById('btnViewList');
    const btnCal = document.getElementById('btnViewCalendar');
    const viewList = document.getElementById('viewListContainer');
    const viewCal = document.getElementById('viewCalendarContainer');
    const overview = document.getElementById('reservasOverview');
    let calendar; // to hold FullCalendar instance

    btnList.addEventListener('click', () => {
        btnList.style.background = 'var(--primary-color)';
        btnList.style.color = '#fff';
        btnCal.style.background = 'transparent';
        btnCal.style.color = 'var(--text-main)';
        viewList.style.display = 'block';
        overview.style.display = 'grid';
        viewCal.style.display = 'none';
    });

    btnCal.addEventListener('click', () => {
        btnCal.style.background = 'var(--primary-color)';
        btnCal.style.color = '#fff';
        btnList.style.background = 'transparent';
        btnList.style.color = 'var(--text-main)';
        viewList.style.display = 'none';
        overview.style.display = 'none';
        viewCal.style.display = 'block';

        // Render calendar if not yet rendered
        if (!calendar) {
            const calendarEl = document.getElementById('calendarEl');
            const events = reservas.map(r => {
                let color = '#fbbf24'; // pendente
                if (r.status === 'confirmada') color = '#34d399';
                if (r.status === 'rejeitada' || r.status === 'cancelada') color = '#ef4444';
                return {
                    id: r.id,
                    title: `${r.cliente_nome} (${r.recursos?.nome})`,
                    start: r.data_hora_inicio,
                    end: r.data_hora_fim,
                    backgroundColor: color,
                    borderColor: 'transparent',
                    extendedProps: {
                        status: r.status,
                        email: r.cliente_email,
                        telemovel: r.cliente_telemovel,
                        preco: r.preco_final,
                        recursoNome: r.recursos?.nome
                    }
                };
            });

            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                locale: 'pt',
                displayEventTime: false,
                eventDidMount: function (info) {
                    info.el.style.cursor = 'pointer';
                },
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                },
                buttonText: {
                    today: 'Hoje',
                    month: 'Mês',
                    week: 'Semana',
                    day: 'Dia'
                },
                events: events,
                eventClick: function (info) {
                    const price = parseFloat(info.event.extendedProps.preco) > 0 ? info.event.extendedProps.preco + '€' : '--';

                    const formataData = (d) => {
                        if (!d) return '';
                        return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                    };
                    const dataRange = info.event.end ? `${formataData(info.event.start)} até ${formataData(info.event.end)}` : formataData(info.event.start);

                    const html = `
                        <ul style="list-style: none; padding: 0; margin: 0; text-align: left; font-size: 0.9rem;">
                            <li style="margin-bottom: 0.4rem; padding-bottom: 0.4rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                <i class="fa-solid fa-user-tag" style="color: var(--primary-color); width: 25px;"></i> 
                                <strong>Reserva de:</strong> ${escapeHTML(info.event.title)}
                            </li>
                            <li style="margin-bottom: 0.4rem; padding-bottom: 0.4rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                <i class="fa-regular fa-calendar-check" style="color: var(--primary-color); width: 25px;"></i> 
                                <strong>Início:</strong> ${formataData(info.event.start)}
                            </li>
                            <li style="margin-bottom: 0.4rem; padding-bottom: 0.4rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                <i class="fa-regular fa-calendar-times" style="color: var(--primary-color); width: 25px;"></i> 
                                <strong>Fim:</strong> ${info.event.end ? formataData(info.event.end) : formataData(info.event.start)}
                            </li>
                            <li style="margin-bottom: 0.4rem; padding-bottom: 0.4rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                <i class="fa-solid fa-circle-half-stroke" style="color: var(--primary-color); width: 25px;"></i> 
                                <strong>Estado:</strong> ${escapeHTML(info.event.extendedProps.status)}
                            </li>
                            <li style="margin-bottom: 0.4rem; padding-bottom: 0.4rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                <i class="fa-solid fa-envelope" style="color: var(--primary-color); width: 25px;"></i> 
                                <strong>Email:</strong> ${escapeHTML(info.event.extendedProps.email)}
                            </li>
                            <li style="margin-bottom: 0.4rem; padding-bottom: 0.4rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                <i class="fa-solid fa-phone" style="color: var(--primary-color); width: 25px;"></i> 
                                <strong>Telemóvel:</strong> ${escapeHTML(info.event.extendedProps.telemovel)}
                            </li>
                            <li>
                                <i class="fa-solid fa-money-bill" style="color: var(--primary-color); width: 25px;"></i> 
                                <strong>Preço:</strong> ${price}
                            </li>
                        </ul>
                    `;
                    window.showInfoModal('Detalhes da Reserva', html);
                }
            });
            calendar.render();
            if (typeof applyFilters === 'function') {
                applyFilters();
            }
        }
    });

    // Action Listeners for Table List
    document.querySelectorAll('.btn-action-reserva').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btnEl = e.currentTarget;
            const id = btnEl.getAttribute('data-id');
            const action = btnEl.getAttribute('data-action');
            const confirmado = await window.showConfirmModal('Atualizar Reserva', 'Atualizar reserva para: ' + action.toUpperCase() + '?');
            if (confirmado) {
                btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                const { error } = await window.supabase.from('reservas').update({ status: action }).eq('id', id);
                if (error) window.showAlertModal('Erro', 'Erro: ' + error.message);
                else setTimeout(() => document.querySelector('[data-view="reservas"]').click(), 0);
            }
        });
    });

    document.querySelectorAll('.btn-delete-reserva').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btnEl = e.currentTarget;
            const id = btnEl.getAttribute('data-id');
            const confirmado = await window.showConfirmModal('Apagar Ocorrência', 'Tem a certeza que deseja APAGAR este registo? Os dados do acompanhante ficarão perdidos indefinidamente.');
            if (confirmado) {
                btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                const { error } = await window.supabase.from('reservas').delete().eq('id', id);
                if (error) window.showAlertModal('Erro', 'Erro: ' + error.message);
                else setTimeout(() => document.querySelector('[data-view="reservas"]').click(), 0);
            }
        });
    });

    // Configurar Flatpickr
    if (window.flatpickr) {
        flatpickr('#editResInicio, #editResFim', {
            locale: "pt",
            enableTime: true,
            time_24hr: true,
            dateFormat: "Y-m-d H:i",
            disableMobile: true
        });
    }

    // Configurar Dropdown de Estado
    const dropdownStatus = document.getElementById('editResStatusDropdown');
    const hiddenStatus = document.getElementById('editResStatus');
    if (dropdownStatus) {
        const selectedEl = dropdownStatus.querySelector('.custom-dropdown-selected');
        const optionsList = dropdownStatus.querySelectorAll('.custom-option');
        const textEl = dropdownStatus.querySelector('.selected-text');

        selectedEl.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownStatus.classList.toggle('open');
        });

        document.addEventListener('click', () => {
            dropdownStatus.classList.remove('open');
        });

        optionsList.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                optionsList.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                textEl.textContent = opt.textContent;
                dropdownStatus.classList.remove('open');
                hiddenStatus.value = opt.getAttribute('data-value');
            });
        });
    }

    // Inline Edit Form Logic
    const formEdit = document.getElementById('formEditReserva');
    const containerEdit = document.getElementById('formContainerReserva');

    document.getElementById('btnCancelarEditReserva')?.addEventListener('click', () => {
        containerEdit.classList.add('hidden');
    });

    document.querySelectorAll('.btn-edit-reserva').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const b = e.currentTarget;
            document.getElementById('editReservaId').value = b.getAttribute('data-id');
            document.getElementById('editResNome').value = b.getAttribute('data-nome');
            document.getElementById('editResEmail').value = b.getAttribute('data-email');
            document.getElementById('editResTelemovel').value = b.getAttribute('data-telemovel');
            document.getElementById('editResPreco').value = b.getAttribute('data-preco');

            const statusVal = b.getAttribute('data-status');
            hiddenStatus.value = statusVal;
            if (dropdownStatus) {
                const opt = dropdownStatus.querySelector(`.custom-option[data-value="${statusVal}"]`);
                if (opt) {
                    dropdownStatus.querySelectorAll('.custom-option').forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    dropdownStatus.querySelector('.selected-text').textContent = opt.textContent;
                }
            }

            const dataI = b.getAttribute('data-inicio');
            const dataF = b.getAttribute('data-fim');

            if (window.flatpickr && document.getElementById('editResInicio')._flatpickr) {
                document.getElementById('editResInicio')._flatpickr.setDate(dataI);
                document.getElementById('editResFim')._flatpickr.setDate(dataF);
            } else {
                document.getElementById('editResInicio').value = dataI;
                document.getElementById('editResFim').value = dataF;
            }

            containerEdit.classList.remove('hidden');
            containerEdit.scrollIntoView({ behavior: 'smooth' });
        });
    });

    formEdit?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const valInicio = document.getElementById('editResInicio').value.replace(' ', 'T');
        const valFim = document.getElementById('editResFim').value.replace(' ', 'T');
        const dataInicio = new Date(valInicio);
        const dataFim = new Date(valFim);

        if (dataInicio >= dataFim) {
            window.showAlertModal('Erro', 'A data de fim não pode ser igual ou anterior à data de início.');
            return;
        }

        const id = document.getElementById('editReservaId').value;
        const btnSave = document.getElementById('btnSalvarEditReserva');
        btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnSave.disabled = true;

        const payload = {
            cliente_nome: document.getElementById('editResNome').value,
            cliente_email: document.getElementById('editResEmail').value,
            cliente_telemovel: document.getElementById('editResTelemovel').value,
            data_hora_inicio: dataInicio.toISOString(),
            data_hora_fim: dataFim.toISOString(),
            preco_final: document.getElementById('editResPreco').value || 0,
            status: document.getElementById('editResStatus').value
        };

        const { error } = await window.supabase.from('reservas').update(payload).eq('id', id);

        btnSave.innerHTML = 'Salvar Alterações';
        btnSave.disabled = false;

        if (error) {
            window.showAlertModal('Erro', 'Erro a atualizar: ' + error.message);
        } else {
            setTimeout(() => document.querySelector('[data-view="reservas"]').click(), 0);
        }
    });

    // Filter logic
    const applyFilters = () => {
        const fCliente = document.getElementById('filterCliente').value.toLowerCase();
        const fRecurso = document.getElementById('filterRecurso').value.toLowerCase();
        const fEstado = document.getElementById('filterEstado').value.toLowerCase();
        const fInicio = document.getElementById('filterDataInicio').value;
        const fFim = document.getElementById('filterDataFim').value;

        const inicioTime = fInicio ? new Date(fInicio).getTime() : null;
        const fimTime = fFim ? new Date(fFim + 'T23:59:59').getTime() : null; // end of day

        let currentCountPendentes = 0;
        let currentCountConfirmadas = 0;

        // Filter Table Rows
        document.querySelectorAll('#viewListContainer tbody tr.reserva-row').forEach(tr => {
            const cliente = (tr.getAttribute('data-cliente') || '').toLowerCase();
            const recurso = (tr.getAttribute('data-recurso') || '').toLowerCase();
            const estado = (tr.getAttribute('data-estado') || '').toLowerCase();
            const inicio = new Date(tr.getAttribute('data-inicio')).getTime();

            let show = true;
            if (fCliente && (!cliente || !cliente.includes(fCliente))) show = false;
            if (fRecurso && (!recurso || recurso !== fRecurso)) show = false;

            if (fEstado) {
                if (fEstado === 'rejeitada') {
                    if (estado !== 'rejeitada' && estado !== 'cancelada') show = false;
                } else {
                    if (estado !== fEstado) show = false;
                }
            }
            if (inicioTime && inicio < inicioTime) show = false;
            if (fimTime && inicio > fimTime) show = false;

            tr.style.display = show ? '' : 'none';

            if (show) {
                if (estado === 'pendente') currentCountPendentes++;
                if (estado === 'confirmada') currentCountConfirmadas++;
            }
        });

        // Filter Calendar
        if (calendar) {
            const filteredEvents = reservas.filter(r => {
                const cliente = (r.cliente_nome + ' ' + (r.cliente_email || '') + ' ' + (r.cliente_telemovel || '')).toLowerCase();
                const recurso = r.recursos ? r.recursos.nome.toLowerCase() : '';
                const estado = r.status.toLowerCase();
                const reservaInicioTime = new Date(r.data_hora_inicio).getTime();

                let show = true;
                if (fCliente && !cliente.includes(fCliente)) show = false;
                if (fRecurso && recurso !== fRecurso) show = false;

                if (fEstado) {
                    if (fEstado === 'rejeitada') {
                        if (estado !== 'rejeitada' && estado !== 'cancelada') show = false;
                    } else {
                        if (estado !== fEstado) show = false;
                    }
                }
                if (inicioTime && reservaInicioTime < inicioTime) show = false;
                if (fimTime && reservaInicioTime > fimTime) show = false;

                return show;
            }).map(r => {
                let color = '#fbbf24';
                if (r.status === 'confirmada') color = '#34d399';
                if (r.status === 'rejeitada' || r.status === 'cancelada') color = '#ef4444';
                return {
                    id: r.id,
                    title: `${r.cliente_nome} (${r.recursos?.nome})`,
                    start: r.data_hora_inicio,
                    end: r.data_hora_fim,
                    backgroundColor: color,
                    borderColor: 'transparent',
                    extendedProps: {
                        status: r.status,
                        email: r.cliente_email,
                        telemovel: r.cliente_telemovel,
                        preco: r.preco_final,
                        recursoNome: r.recursos?.nome
                    }
                };
            });

            calendar.removeAllEvents();
            calendar.addEventSource(filteredEvents);
        }

        document.getElementById('overviewPendentes').textContent = currentCountPendentes;
        document.getElementById('overviewConfirmadas').textContent = currentCountConfirmadas;
    };

    // Filter logic UI setup
    const btnToggleF = document.getElementById('btnToggleFilters');
    const fContainer = document.getElementById('filtersContainer');
    if (btnToggleF) {
        btnToggleF.addEventListener('click', () => {
            fContainer.classList.toggle('hidden');
            if (fContainer.classList.contains('hidden')) {
                btnToggleF.innerHTML = '<i class="fa-solid fa-filter"></i> Mostrar Filtros';
            } else {
                btnToggleF.innerHTML = '<i class="fa-solid fa-filter"></i> Ocultar Filtros';
            }
        });
    }

    if (window.flatpickr) {
        flatpickr('#filterDataInicio, #filterDataFim', {
            locale: "pt",
            dateFormat: "Y-m-d",
            disableMobile: true,
            onChange: applyFilters
        });
    }

    const setDropdownFilter = (dropdownId, hiddenInputId) => {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;
        const selectedEl = dropdown.querySelector('.custom-dropdown-selected');
        const optionsList = dropdown.querySelectorAll('.custom-option');
        const textEl = dropdown.querySelector('.selected-text');
        const hiddenInput = document.getElementById(hiddenInputId);

        selectedEl.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });

        optionsList.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                optionsList.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                textEl.textContent = opt.textContent;
                dropdown.classList.remove('open');
                hiddenInput.value = opt.getAttribute('data-value');
                applyFilters();
            });
        });
    };

    setDropdownFilter('filterRecursoDropdown', 'filterRecurso');
    setDropdownFilter('filterEstadoDropdown', 'filterEstado');

    document.addEventListener('click', (e) => {
        document.getElementById('filterRecursoDropdown')?.classList.remove('open');
        document.getElementById('filterEstadoDropdown')?.classList.remove('open');
    });

    ['filterCliente'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', applyFilters);
    });

    document.getElementById('btnLimparFiltros')?.addEventListener('click', () => {
        document.getElementById('filterCliente').value = '';

        // reset recurso dropdown
        document.getElementById('filterRecurso').value = '';
        const recDrop = document.getElementById('filterRecursoDropdown');
        if (recDrop) {
            recDrop.querySelectorAll('.custom-option').forEach(o => o.classList.remove('active'));
            const initialRec = recDrop.querySelector('.custom-option[data-value=""]');
            if (initialRec) initialRec.classList.add('active');
            recDrop.querySelector('.selected-text').textContent = 'Todos os Recursos';
        }

        // reset estado dropdown
        document.getElementById('filterEstado').value = '';
        const stDrop = document.getElementById('filterEstadoDropdown');
        if (stDrop) {
            stDrop.querySelectorAll('.custom-option').forEach(o => o.classList.remove('active'));
            const initialSt = stDrop.querySelector('.custom-option[data-value=""]');
            if (initialSt) initialSt.classList.add('active');
            stDrop.querySelector('.selected-text').textContent = 'Todos os Estados';
        }

        if (window.flatpickr) {
            document.getElementById('filterDataInicio')._flatpickr?.clear();
            document.getElementById('filterDataFim')._flatpickr?.clear();
        } else {
            document.getElementById('filterDataInicio').value = '';
            document.getElementById('filterDataFim').value = '';
        }
        applyFilters();
    });

    // Nova Reserva removida daqui - ver módulo dashboard (nova_reserva_widget.js)
}

function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}
