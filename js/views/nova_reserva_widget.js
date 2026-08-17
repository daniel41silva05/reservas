export async function renderNovaReservaWidget(container, session) {
    const empId = window.dashboardContext.currentEmpresaId;
    const isHotel = window.dashboardContext.currentEmpresaTipo && window.dashboardContext.currentEmpresaTipo.toLowerCase() === 'hotel';

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

    let resourcesOptions = '<option value="" disabled selected>Selecione uma opção...</option>';
    if (recursos && recursos.length > 0) {
        resourcesOptions += recursos.map(r => `<option value="${r.id}">${escapeHTML(r.nome)}</option>`).join('');
    } else {
        resourcesOptions = '<option value="" disabled>Nenhum recurso disponível/ativo.</option>';
    }

    // 2. Build the UI
    // Mimics widget.js but uses dashboard styling classes
    let html = `
        <div class="glass-panel" style="padding: 1.5rem; max-width: 600px; margin: 0 auto;">
            <div style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                <h3>Nova Reserva</h2>
                <p class="text-sub" style="font-size: 0.85rem;">Insira uma reserva atuando como cliente usando o widget interno.</p>
            </div>
            
            <div id="nr-alert" style="padding: 10px; border-radius: 4px; margin-bottom: 15px; display: none;"></div>

            <form id="nr-form">
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>Escolha o Recurso/Serviço</label>
                    <select id="nr-recurso" class="form-control" required ${recursos && recursos.length > 0 ? '' : 'disabled'}>
                        ${resourcesOptions}
                    </select>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div class="form-group">
                        <label>Data/Hora Chegada</label>
                        <input type="datetime-local" id="nr-inicio" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Data/Hora Saída</label>
                        <input type="datetime-local" id="nr-fim" class="form-control" required>
                    </div>
                </div>
                
                ${isHotel ? `
                <div style="margin-bottom: 1rem;">
                    <div id="nr-price-display" style="margin-top: 0.5rem; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px;">
                        <span style="font-size: 0.9rem;">Preço Previsto (Auto): </span>
                        <strong id="nr-total-val" style="color: var(--success); font-size: 1.1rem;">A aguardar dadas...</strong>
                    </div>
                </div>
                ` : ''}

                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>Seu Nome (ou Nome Cliente)</label>
                    <input type="text" id="nr-nome" class="form-control" required placeholder="Ex: João Silva">
                </div>
                
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label>Contacto (Tlm / Email)</label>
                    <input type="text" id="nr-contacto" class="form-control" required placeholder="912345678 ou joao@email.com">
                </div>

                <button type="submit" class="btn btn-primary" id="nr-submit-btn" style="width: 100%;"><i class="fa-solid fa-check"></i> Solicitar Reserva</button>
            </form>
        </div>
    `;

    container.innerHTML = html;

    setupWidgetListeners(empId, isHotel);
}

function setupWidgetListeners(empId, isHotel) {
    const form = document.getElementById('nr-form');
    const inputInicio = document.getElementById('nr-inicio');
    const inputFim = document.getElementById('nr-fim');
    const selectRecurso = document.getElementById('nr-recurso');
    const alertBox = document.getElementById('nr-alert');
    let precoCalculado = 0;

    const showAlert = (msg, isError = true) => {
        alertBox.style.display = 'block';
        alertBox.style.background = isError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)';
        alertBox.style.color = isError ? '#f87171' : '#4ade80';
        alertBox.style.border = isError ? '1px solid #ef4444' : '1px solid #22c55e';
        alertBox.textContent = msg;
    };

    const hideAlert = () => alertBox.style.display = 'none';

    async function checkOverlaps(table, recursoId, startIso, endIso) {
        // Query conflicts directly
        const selectStr = table === 'reservas' ? 'data_hora_inicio, data_hora_fim, status' : 'data_hora_inicio, data_hora_fim';
        const { data, error } = await window.supabase
            .from(table)
            .select(selectStr)
            .eq('recurso_id', recursoId);

        if (error || !data) return false;

        const start = new Date(startIso);
        const end = new Date(endIso);

        for (let idx = 0; idx < data.length; idx++) {
            // Se for reserva, ignora rejeitadas/canceladas
            if (table === 'reservas' && (data[idx].status === 'rejeitada' || data[idx].status === 'cancelada')) {
                continue;
            }
            const rowStart = new Date(data[idx].data_hora_inicio);
            const rowEnd = new Date(data[idx].data_hora_fim);

            if (start < rowEnd && end > rowStart) {
                return true; // Overlap detected
            }
        }
        return false;
    }

    const btnCalc = async () => {
        if (!isHotel) return; // Only process if it is a hotel

        const recursoId = selectRecurso.value;
        const tInicio = inputInicio.value;
        const tFim = inputFim.value;
        const msgEl = document.getElementById('nr-total-val');

        if (!recursoId || !tInicio || !tFim) {
            msgEl.textContent = 'A aguardar dadas...';
            msgEl.style.color = 'var(--text-secondary)';
            precoCalculado = null;
            return;
        }

        const inicio = new Date(tInicio);
        const fim = new Date(tFim);

        if (inicio >= fim) {
            msgEl.textContent = 'Datas inválidas';
            msgEl.style.color = 'var(--danger)';
            precoCalculado = null;
            return;
        }

        msgEl.textContent = 'A calcular...';
        msgEl.style.color = 'var(--warning)';

        const { data: precosData, error } = await window.supabase
            .from('precos')
            .select('preco_base, data_inicio, data_fim')
            .eq('recurso_id', recursoId);

        if (error || !precosData || precosData.length === 0) {
            msgEl.textContent = 'Sem valor previsto nestas datas (vazio)';
            msgEl.style.color = 'var(--text-secondary)';
            precoCalculado = 0;
        } else {
            let total = 0;
            let missingPrice = false;

            let current = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
            const endDate = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());

            // If it's a same-day reservation, treat as 1 day minimum for hotels
            if (current.getTime() === endDate.getTime()) {
                endDate.setDate(endDate.getDate() + 1);
            }

            // Find default price (if any)
            let defaultPrice = null;
            for (let p of precosData) {
                if (!p.data_inicio && !p.data_fim) {
                    defaultPrice = parseFloat(p.preco_base);
                    break;
                }
            }

            while (current < endDate) {
                let foundPrice = null;
                for (let p of precosData) {
                    if (p.data_inicio && p.data_fim) {
                        let pStart = new Date(p.data_inicio + "T00:00:00");
                        let pEnd = new Date(p.data_fim + "T23:59:59");
                        if (current >= pStart && current <= pEnd) {
                            foundPrice = parseFloat(p.preco_base);
                            break;
                        }
                    }
                }

                if (foundPrice === null) {
                    if (defaultPrice !== null) {
                        foundPrice = defaultPrice;
                        total += foundPrice;
                    } else {
                        missingPrice = true;
                        break;
                    }
                } else {
                    total += foundPrice;
                }
                current.setDate(current.getDate() + 1);
            }

            if (missingPrice) {
                msgEl.textContent = 'Sem valor previsto nestas datas (vazio)';
                msgEl.style.color = 'var(--text-secondary)';
                precoCalculado = 0;
            } else {
                precoCalculado = total;
                msgEl.textContent = precoCalculado.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
                msgEl.style.color = 'var(--success)';
            }
        }
    };

    if (isHotel) {
        inputInicio.addEventListener('change', btnCalc);
        inputFim.addEventListener('change', btnCalc);
        selectRecurso.addEventListener('change', btnCalc);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const recursoId = selectRecurso.value;
        const tInicio = inputInicio.value;
        const tFim = inputFim.value;
        const nome = document.getElementById('nr-nome').value;
        const contacto = document.getElementById('nr-contacto').value;

        if (!recursoId) return;

        const inicio = new Date(tInicio).toISOString();
        const fim = new Date(tFim).toISOString();

        if (new Date(inicio) >= new Date(fim)) {
            showAlert('As datas fornecidas são inválidas.');
            return;
        }

        const submitBtn = document.getElementById('nr-submit-btn');
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A Processar...';
        submitBtn.disabled = true;

        // Validation against Overlaps (Bloqueios and other Reservas)
        const isBlocked = await checkOverlaps('bloqueios_disponibilidade', recursoId, inicio, fim);
        if (isBlocked) {
            showAlert('Período bloqueado. Não é possível reservar nestas datas.');
            submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Solicitar Reserva';
            submitBtn.disabled = false;
            return;
        }

        const isBooked = await checkOverlaps('reservas', recursoId, inicio, fim);
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
            cliente_contacto: contacto,
            data_hora_inicio: inicio,
            data_hora_fim: fim,
            preco_final: precoCalculado || 0, // defaults to 0 if not calculated/applicable
            status: 'pendente'
        };

        const { error } = await window.supabase.from('reservas').insert([payload]);

        submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Solicitar Reserva';
        submitBtn.disabled = false;

        if (error) {
            showAlert('Erro ao inserir: ' + error.message);
        } else {
            form.innerHTML = `
                <div style="text-align: center; padding: 2rem 0;">
                    <i class="fa-solid fa-circle-check" style="font-size: 3rem; color: var(--success); margin-bottom: 1rem;"></i>
                    <h4>Reserva Submetida!</h4>
                    <p class="text-sub">Ficará pendente nos registos para revisão.</p>
                    <button class="btn btn-primary" onclick="document.querySelector('[data-view=\\'reservas\\']').click()" style="margin-top: 1.5rem;">Ver Reservas</button>
                </div>
            `;
        }
    });
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
