export async function renderBloqueios(container, session) {
    const empId = window.dashboardContext.currentEmpresaId;

    if (!empId) {
        container.innerHTML = `<div class="glass-panel" style="padding: 2rem; text-align: center;"><p class="text-sub">Por favor, escolha ou crie uma empresa primeiro.</p></div>`;
        return;
    }

    // A logica aqui vai ser idêntica aos preços. 
    // É uma listagem de períodos bloqueados (data/hora).
    const { data: bloqueios, error } = await window.supabase
        .from('bloqueios_disponibilidade')
        .select(`
            *,
            recursos(nome)
        `)
        .eq('empresa_id', empId)
        .order('data_hora_inicio', { ascending: true });

    // Precisamos das empresas e recursos para o formulário
    const { data: meusRecursos } = await window.supabase
        .from('recursos')
        .select('id, nome, empresa_id')
        .eq('empresa_id', empId)
        .eq('ativo', true);

    if (error) {
        container.innerHTML = `<div class="glass-panel" style="padding: 2rem; color: var(--danger);">Erro a carregar bloqueios: ${error.message}</div>`;
        return;
    }

    let html = `
        <div class="glass-panel" style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div>
                    <h3>Bloqueios de Agenda</h3>
                    <p class="text-sub" style="font-size: 0.85rem;">Insira períodos de férias ou manutenção que vão bloquear este recurso ao público.</p>
                </div>
                <button class="btn btn-primary" id="btnNovoBloqueio" style="padding: 0.5rem 1rem; font-size: 0.85rem;"><i class="fa-solid fa-plus"></i> Inserir Bloqueio</button>
            </div>

            <!-- Formulário Novo/Editar Bloqueio -->
            <div id="formContainerBloqueio" class="hidden" style="margin-bottom: 2rem; padding: 1.5rem; border: 1px solid var(--border-color); border-radius: 8px; background: rgba(0,0,0,0.2);">
                <h4 id="formBloqueioTitle" style="margin-bottom: 1rem;">Bloquear Calendário</h4>
                <form id="formBloqueio">
                    <input type="hidden" id="bloqueioId" value="">
                    
                    <div style="display: flex; gap: 1rem; align-items: stretch; margin-bottom: 1.5rem; flex-wrap: wrap;">
                        <div class="form-group" style="flex: 1; min-width: 250px; margin: 0; display: flex; flex-direction: column;">
                            <label>Recurso a Bloquear</label>
                            <input type="hidden" id="bloqueioRecursoId" value="">
                            <div class="custom-dropdown" id="bloqueiosRecursoDropdown" style="width: 100%;">
                                <div class="custom-dropdown-selected" tabindex="0" style="padding: 0.9rem 1.2rem;">
                                    <i class="fa-solid fa-cube icon-left"></i>
                                    <span class="selected-text">Escolha o recurso...</span>
                                    <i class="fa-solid fa-chevron-down icon-arrow"></i>
                                </div>
                                <div class="custom-dropdown-menu">
                                    ${meusRecursos && meusRecursos.length > 0
            ? meusRecursos.map(r => `<div class="custom-option" data-value="${r.id}">${escapeHTML(r.nome)}</div>`).join('')
            : `<div class="custom-option disabled" style="cursor: default;">Nenhum recurso encontrado na empresa.</div>`}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                        <div class="form-group">
                            <label>Início (Data e Hora)</label>
                            <div style="position: relative; display: flex; align-items: center;">
                                <input type="text" id="bloqueioDataInicio" class="form-control" placeholder="Selecione data e hora iniciais" required>
                                <i class="fa-regular fa-calendar" style="position: absolute; right: 15px; color: var(--text-muted); pointer-events: none; font-size: 1.1rem;"></i>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Fim (Data e Hora)</label>
                            <div style="position: relative; display: flex; align-items: center;">
                                <input type="text" id="bloqueioDataFim" class="form-control" placeholder="Selecione data e hora finais" required>
                                <i class="fa-regular fa-calendar" style="position: absolute; right: 15px; color: var(--text-muted); pointer-events: none; font-size: 1.1rem;"></i>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" id="btnCancelarBloqueio">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btnSalvarBloqueio">Salvar Bloqueio</button>
                    </div>
                    <p id="bloqueioMsg" class="error-msg" style="margin-top: 1rem;"></p>
                </form>
            </div>

            <div class="data-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Recurso</th>
                            <th>Bloqueado De</th>
                            <th>Até</th>
                            <th style="text-align: right;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    // Função auxiliar para formatar datas vindo do timestamptz postgres para algo legível (d/m/Y - h:m)
    const formataDataHora = (isoStr) => {
        const d = new Date(isoStr);
        return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (bloqueios && bloqueios.length > 0) {
        bloqueios.forEach(bloq => {
            const recursoNome = bloq.recursos ? bloq.recursos.nome : 'Recurso Removido';

            const inicioISO = new Date(bloq.data_hora_inicio);
            const fimISO = new Date(bloq.data_hora_fim);

            // Format for flatpickr (Y-m-d H:i)
            const formatForInput = (d) => {
                const off = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
                return off.replace('T', ' ');
            };

            html += `
                <tr>
                    <td><strong>${escapeHTML(recursoNome)}</strong></td>
                    <td>${formataDataHora(bloq.data_hora_inicio)}</td>
                    <td>${formataDataHora(bloq.data_hora_fim)}</td>
                    <td style="text-align: right;">
                        <button class="btn btn-secondary btn-edit-bloqueio" data-id="${bloq.id}" data-empresa="${bloq.empresa_id}" data-recurso="${bloq.recurso_id}" data-inicio="${formatForInput(inicioISO)}" data-fim="${formatForInput(fimISO)}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto;"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-secondary btn-delete-bloqueio" data-id="${bloq.id}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto; color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } else {
        html += `<tr><td colspan="4">Nenhum bloqueio configurado.</td></tr>`;
    }

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;

    setupBloqueiosListeners(meusRecursos);
}

function setupBloqueiosListeners(meusRecursos) {
    const mainForm = document.getElementById('formBloqueio');
    if (!mainForm) return;

    if (window.flatpickr) {
        flatpickr('#bloqueioDataInicio, #bloqueioDataFim', {
            locale: "pt",
            enableTime: true,
            time_24hr: true,
            dateFormat: "Y-m-d H:i",
            disableMobile: true
        });
    }

    const btnNovo = document.getElementById('btnNovoBloqueio');
    const formContainer = document.getElementById('formContainerBloqueio');
    const btnCancelar = document.getElementById('btnCancelarBloqueio');
    const title = document.getElementById('formBloqueioTitle');
    const selectRecurso = document.getElementById('bloqueioRecursoId');

    // Custom Dropdown Logic
    const dropdown = document.getElementById('bloqueiosRecursoDropdown');
    if (dropdown) {
        const selectedEl = dropdown.querySelector('.custom-dropdown-selected');
        const optionsList = dropdown.querySelectorAll('.custom-option:not(.disabled)');
        const textEl = dropdown.querySelector('.selected-text');
        const hiddenInput = document.getElementById('bloqueioRecursoId');

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
                hiddenInput.value = opt.getAttribute('data-value');
            });
        });
    }

    btnNovo.addEventListener('click', () => {
        mainForm.reset();
        document.getElementById('bloqueioId').value = '';
        document.getElementById('bloqueioRecursoId').value = '';
        if (dropdown) {
            dropdown.querySelector('.selected-text').textContent = 'Escolha o recurso...';
            dropdown.querySelectorAll('.custom-option').forEach(o => o.classList.remove('active'));
        }
        document.getElementById('bloqueioMsg').style.display = 'none';
        title.textContent = 'Inserir Bloqueio';
        formContainer.classList.remove('hidden');
        formContainer.scrollIntoView({ behavior: 'smooth' });
    });

    btnCancelar.addEventListener('click', () => {
        formContainer.classList.add('hidden');
    });

    mainForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgInfo = document.getElementById('bloqueioMsg');
        const btnSalvar = document.getElementById('btnSalvarBloqueio');

        const id = document.getElementById('bloqueioId').value;
        const empresaId = window.dashboardContext.currentEmpresaId;
        const recursoId = document.getElementById('bloqueioRecursoId').value;
        // O Supabase converte ISO ISO-8606 / timestamptz. Pegamos do date-time
        // Convertendo de hora local para ISO para enviar:
        const valInicio = document.getElementById('bloqueioDataInicio').value.replace(' ', 'T');
        const valFim = document.getElementById('bloqueioDataFim').value.replace(' ', 'T');
        const dataInicio = new Date(valInicio).toISOString();
        const dataFim = new Date(valFim).toISOString();

        if (!recursoId) {
            msgInfo.textContent = "Erro: Selecione um recurso da empresa.";
            msgInfo.style.display = 'block';
            return;
        }

        if (new Date(dataInicio) >= new Date(dataFim)) {
            msgInfo.textContent = "Erro: A data final tem de ser posterior à inicial.";
            msgInfo.style.display = 'block';
            return;
        }

        const isOverlap = await checkOverlaps(id, recursoId, dataInicio, dataFim);
        if (isOverlap) {
            msgInfo.textContent = "Erro: O calendário já possui um bloqueio nestas datas para este recurso. Verifique as concorrências.";
            msgInfo.style.display = 'block';
            return;
        }

        msgInfo.style.display = 'none';
        btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnSalvar.disabled = true;

        const payload = {
            empresa_id: empresaId,
            recurso_id: recursoId,
            data_hora_inicio: dataInicio,
            data_hora_fim: dataFim
        };

        let reqError;

        if (id) {
            const { error } = await window.supabase.from('bloqueios_disponibilidade').update(payload).eq('id', id);
            reqError = error;
        } else {
            const { error } = await window.supabase.from('bloqueios_disponibilidade').insert([payload]);
            reqError = error;
        }

        btnSalvar.innerHTML = 'Salvar Bloqueio';
        btnSalvar.disabled = false;

        if (reqError) {
            msgInfo.textContent = "Erro: " + reqError.message;
            msgInfo.style.display = 'block';
        } else {
            setTimeout(() => document.querySelector('[data-view="bloqueios"]').click(), 0);
        }
    });

    document.querySelectorAll('.btn-edit-bloqueio').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.currentTarget;
            document.getElementById('bloqueioId').value = btnEl.getAttribute('data-id');

            const recursoId = btnEl.getAttribute('data-recurso');
            document.getElementById('bloqueioRecursoId').value = recursoId;

            if (dropdown) {
                const opt = dropdown.querySelector(`.custom-option[data-value="${recursoId}"]`);
                if (opt) {
                    dropdown.querySelectorAll('.custom-option').forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    dropdown.querySelector('.selected-text').textContent = opt.textContent;
                }
            }

            const dataI = btnEl.getAttribute('data-inicio');
            const dataF = btnEl.getAttribute('data-fim');

            if (window.flatpickr && document.getElementById('bloqueioDataInicio')._flatpickr) {
                document.getElementById('bloqueioDataInicio')._flatpickr.setDate(dataI);
                document.getElementById('bloqueioDataFim')._flatpickr.setDate(dataF);
            } else {
                document.getElementById('bloqueioDataInicio').value = dataI;
                document.getElementById('bloqueioDataFim').value = dataF;
            }

            title.textContent = 'Editar Bloqueio de Calendário';
            formContainer.classList.remove('hidden');
            formContainer.scrollIntoView({ behavior: 'smooth' });
        });
    });

    document.querySelectorAll('.btn-delete-bloqueio').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const confirmado = await window.showConfirmModal('Remover Bloqueio', 'Tem a certeza que deseja remover este bloqueio e repôr a disponibilidade?');
            if (confirmado) {
                const { error } = await window.supabase.from('bloqueios_disponibilidade').delete().eq('id', id);
                if (error) {
                    window.showAlertModal('Erro', 'Erro a eliminar: ' + error.message);
                } else {
                    setTimeout(() => document.querySelector('[data-view="bloqueios"]').click(), 0);
                }
            }
        });
    });

    async function checkOverlaps(editId, recursoId, startStr, endStr) {
        const start = new Date(startStr);
        const end = new Date(endStr);

        const { data } = await window.supabase.from('bloqueios_disponibilidade')
            .select('id, data_hora_inicio, data_hora_fim')
            .eq('recurso_id', recursoId);

        if (!data) return false;

        for (let r of data) {
            if (editId && r.id == editId) continue;
            let rs = new Date(r.data_hora_inicio);
            let re = new Date(r.data_hora_fim);
            if (start < re && end > rs) return true; // Strict time overlap
        }
        return false;
    }
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
