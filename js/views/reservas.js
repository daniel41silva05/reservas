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
                    <div style="display: flex; background: rgba(255, 255, 255, 0.05); border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color);">
                        <button id="btnViewList" class="btn" style="border-radius: 0; background: var(--accent-primary); border: none; padding: 0.5rem 1rem;">Lista</button>
                        <button id="btnViewCalendar" class="btn" style="border-radius: 0; background: transparent; border: none; padding: 0.5rem 1rem;">Calendário</button>
                    </div>
                </div>
            </div>

            <div id="reservasOverview" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--warning);">
                    <h5 style="color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase; font-size: 0.75rem;">Pendentes</h5>
                    <div style="font-size: 1.5rem; font-weight: 700;">${countPendentes}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--success);">
                    <h5 style="color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase; font-size: 0.75rem;">Confirmadas</h5>
                    <div style="font-size: 1.5rem; font-weight: 700;">${countConfirmadas}</div>
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
                            <label>Contacto</label>
                            <input type="text" id="editResContacto" class="form-control" required>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div class="form-group">
                            <label>Início</label>
                            <input type="datetime-local" id="editResInicio" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>Fim</label>
                            <input type="datetime-local" id="editResFim" class="form-control" required>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div class="form-group">
                            <label>Preço Final (€)</label>
                            <input type="number" step="0.01" id="editResPreco" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>Estado</label>
                            <select id="editResStatus" class="form-control" required>
                                <option value="pendente">Pendente</option>
                                <option value="confirmada">Confirmada</option>
                            </select>
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
            const formatForInput = (d) => new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

            html += `
                <tr style="${res.status === 'pendente' ? 'background: rgba(245, 158, 11, 0.05);' : ''}">
                    <td><strong>${escapeHTML(recursoNome)}</strong></td>
                    <td>${escapeHTML(res.cliente_nome)}<br><small class="text-sub">${escapeHTML(res.cliente_contacto)}</small></td>
                    <td style="font-size: 0.85rem;">${formataDataHora(res.data_hora_inicio)}<br><span style="color: var(--text-secondary);">até</span> ${formataDataHora(res.data_hora_fim)}</td>
                    <td><strong>${(res.preco_final && parseFloat(res.preco_final) > 0) ? parseFloat(res.preco_final).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }) : '<span class="text-sub">--</span>'}</strong></td>
                    <td>${getStatusBadge(res.status)}</td>
                    <td style="text-align: right; display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center;">
                        <button class="btn btn-secondary btn-edit-reserva" 
                            data-id="${res.id}" 
                            data-nome="${escapeHTML(res.cliente_nome)}" 
                            data-contacto="${escapeHTML(res.cliente_contacto)}" 
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
        btnList.style.background = 'var(--accent-primary)';
        btnCal.style.background = 'transparent';
        viewList.style.display = 'block';
        overview.style.display = 'grid';
        viewCal.style.display = 'none';
    });

    btnCal.addEventListener('click', () => {
        btnCal.style.background = 'var(--accent-primary)';
        btnList.style.background = 'transparent';
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
                        contacto: r.cliente_contacto,
                        preco: r.preco_final,
                        recursoNome: r.recursos?.nome
                    }
                };
            });

            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                locale: 'pt',
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
                    window.showAlertModal('Detalhes da Reserva', `Reserva de: ${info.event.title}\nEstado: ${info.event.extendedProps.status}\nContacto: ${info.event.extendedProps.contacto}\nPreço: ${info.event.extendedProps.preco}€`);
                }
            });
            calendar.render();
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
            document.getElementById('editResContacto').value = b.getAttribute('data-contacto');
            document.getElementById('editResInicio').value = b.getAttribute('data-inicio');
            document.getElementById('editResFim').value = b.getAttribute('data-fim');
            document.getElementById('editResPreco').value = b.getAttribute('data-preco');
            document.getElementById('editResStatus').value = b.getAttribute('data-status');

            containerEdit.classList.remove('hidden');
            containerEdit.scrollIntoView({ behavior: 'smooth' });
        });
    });

    formEdit?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const dataInicio = new Date(document.getElementById('editResInicio').value);
        const dataFim = new Date(document.getElementById('editResFim').value);

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
            cliente_contacto: document.getElementById('editResContacto').value,
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

    // Nova Reserva removida daqui - ver módulo dashboard (nova_reserva_widget.js)
}

function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}
