export async function renderBloqueios(container, session) {
    const empId = window.dashboardContext.currentEmpresaId;

    if (!empId) {
        container.innerHTML = `<div class="glass-panel" style="padding: 2rem; text-align: center;"><p class="text-sub">Por favor, escolha ou crie uma empresa primeiro.</p></div>`;
        return;
    }

    // Load Period Blockages
    const { data: bloqueios, error } = await window.supabase
        .from('bloqueios_disponibilidade')
        .select(`*, recursos(nome)`)
        .eq('empresa_id', empId)
        .order('data_hora_inicio', { ascending: true });

    // Load Recurring Blockages
    const { data: bloqueiosRecorrentes, error: errRecorrentes } = await window.supabase
        .from('bloqueios_recorrentes')
        .select(`*, recursos(nome)`)
        .eq('empresa_id', empId)
        .order('dia_semana', { ascending: true });

    // Load Active Resources
    const { data: meusRecursos } = await window.supabase
        .from('recursos')
        .select('id, nome, empresa_id')
        .eq('empresa_id', empId)
        .eq('ativo', true);

    if (error || errRecorrentes) {
        container.innerHTML = `<div class="glass-panel" style="padding: 2rem; color: var(--danger);">Erro a carregar bloqueios: ${error?.message || errRecorrentes?.message}</div>`;
        return;
    }

    let html = `
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <h3>Gestão de Bloqueios</h3>
                    <p class="text-sub" style="font-size: 0.85rem;">Defina dias de fecho regulares ou bloqueie períodos específicos (férias, obras).</p>
                </div>
                <div style="display: flex; background: rgba(255, 255, 255, 0.1); border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color);">
                    <button id="btnViewPeriodo" class="btn" style="border-radius: 0; background: var(--primary-color); color: #fff; border: none; padding: 0.5rem 1rem;">Bloqueios de Período</button>
                    <button id="btnViewRecorrente" class="btn" style="border-radius: 0; background: transparent; color: var(--text-main); border: none; padding: 0.5rem 1rem;">Horários Fixos (Semanais)</button>
                </div>
            </div>
            
            <!-- SECTION 1: BLOQUEIOS DE PERIODO -->
            <div id="sectionPeriodo">
                <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
                    <button class="btn btn-primary" id="btnNovoBloqueio" style="padding: 0.5rem 1rem; font-size: 0.85rem;"><i class="fa-solid fa-plus"></i> Inserir Bloqueio Único</button>
                </div>

                <div id="formContainerBloqueio" class="hidden" style="margin-bottom: 2rem; padding: 1.5rem; border: 1px solid var(--border-color); border-radius: 8px; background: rgba(0,0,0,0.2);">
                    <h4 id="formBloqueioTitle" style="margin-bottom: 1rem;">Bloquear Calendário (Período)</h4>
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

    const formataDataHora = (isoStr) => {
        const d = new Date(isoStr);
        return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (bloqueios && bloqueios.length > 0) {
        bloqueios.forEach(bloq => {
            const recursoNome = bloq.recursos ? bloq.recursos.nome : 'Recurso Removido';
            const inicioISO = new Date(bloq.data_hora_inicio);
            const fimISO = new Date(bloq.data_hora_fim);
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
        html += `<tr><td colspan="4">Nenhum bloqueio periódico configurado.</td></tr>`;
    }

    html += `           </tbody>
                    </table>
                </div>
            </div>

            <!-- SECTION 2: BLOQUEIOS RECORRENTES -->
            <div id="sectionRecorrente" style="display: none;">
                <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
                    <button class="btn btn-primary" id="btnNovoRecorrente" style="padding: 0.5rem 1rem; font-size: 0.85rem;"><i class="fa-solid fa-plus"></i> Inserir Horário Fixo</button>
                </div>

                <div id="formContainerRecorrente" class="hidden" style="margin-bottom: 2rem; padding: 1.5rem; border: 1px solid var(--border-color); border-radius: 8px; background: rgba(0,0,0,0.2);">
                    <h4 id="formRecorrenteTitle" style="margin-bottom: 1rem;">Bloquear Dia da Semana Regularmente</h4>
                    <form id="formRecorrente">
                        <input type="hidden" id="recorrenteId" value="">
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                            
                            <div class="form-group" style="display: flex; flex-direction: column;">
                                <label>Recurso a Bloquear</label>
                                <input type="hidden" id="recRecursoId" value="">
                                <div class="custom-dropdown" id="recRecursoDropdown" style="width: 100%;">
                                    <div class="custom-dropdown-selected" tabindex="0" style="padding: 0.9rem 1.2rem;">
                                        <i class="fa-solid fa-cube icon-left"></i>
                                        <span class="selected-text">Escolha o recurso...</span>
                                        <i class="fa-solid fa-chevron-down icon-arrow"></i>
                                    </div>
                                    <div class="custom-dropdown-menu">
                                        ${meusRecursos && meusRecursos.length > 0
            ? meusRecursos.map(r => `<div class="custom-option" data-value="${r.id}">${escapeHTML(r.nome)}</div>`).join('')
            : `<div class="custom-option disabled" style="cursor: default;">Nenhum recurso encontrado.</div>`}
                                    </div>
                                </div>
                            </div>
                            
                            <div class="form-group" style="display: flex; flex-direction: column;">
                                <label>Dia da Semana</label>
                                <input type="hidden" id="recDiaSemana" value="">
                                <div class="custom-dropdown" id="recDiaDropdown" style="width: 100%;">
                                    <div class="custom-dropdown-selected" tabindex="0" style="padding: 0.9rem 1.2rem;">
                                        <i class="fa-solid fa-calendar-day icon-left"></i>
                                        <span class="selected-text">Escolha o dia...</span>
                                        <i class="fa-solid fa-chevron-down icon-arrow"></i>
                                    </div>
                                    <div class="custom-dropdown-menu">
                                        <div class="custom-option" data-value="1">Segunda-feira</div>
                                        <div class="custom-option" data-value="2">Terça-feira</div>
                                        <div class="custom-option" data-value="3">Quarta-feira</div>
                                        <div class="custom-option" data-value="4">Quinta-feira</div>
                                        <div class="custom-option" data-value="5">Sexta-feira</div>
                                        <div class="custom-option" data-value="6">Sábado</div>
                                        <div class="custom-option" data-value="0">Domingo</div>
                                    </div>
                                </div>
                            </div>

                        </div>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                            <div class="form-group">
                                <label>Começa às</label>
                                <div style="position: relative; display: flex; align-items: center;">
                                    <input type="text" id="recHoraInicio" class="form-control" placeholder="00:00" required>
                                    <i class="fa-regular fa-clock" style="position: absolute; right: 15px; color: var(--text-muted); pointer-events: none; font-size: 1.1rem;"></i>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Termina às</label>
                                <div style="position: relative; display: flex; align-items: center;">
                                    <input type="text" id="recHoraFim" class="form-control" placeholder="23:59" required>
                                    <i class="fa-regular fa-clock" style="position: absolute; right: 15px; color: var(--text-muted); pointer-events: none; font-size: 1.1rem;"></i>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                            <button type="button" class="btn btn-secondary" id="btnCancelarRecorrente">Cancelar</button>
                            <button type="submit" class="btn btn-primary" id="btnSalvarRecorrente">Salvar Horário</button>
                        </div>
                    </form>
                </div>

                <div class="data-table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Recurso</th>
                                <th>Dia da Semana</th>
                                <th>Horário</th>
                                <th style="text-align: right;">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
    `;

    const mapDia = { 0: 'Domingo', 1: 'Segunda-feira', 2: 'Terça-feira', 3: 'Quarta-feira', 4: 'Quinta-feira', 5: 'Sexta-feira', 6: 'Sábado' };

    if (bloqueiosRecorrentes && bloqueiosRecorrentes.length > 0) {
        bloqueiosRecorrentes.forEach(bloq => {
            const recursoNome = bloq.recursos ? bloq.recursos.nome : 'Recurso Removido';
            const hrInicio = bloq.hora_inicio.substring(0, 5); // From 08:00:00 to 08:00
            const hrFim = bloq.hora_fim.substring(0, 5);

            html += `
                <tr>
                    <td><strong>${escapeHTML(recursoNome)}</strong></td>
                    <td>${mapDia[bloq.dia_semana]}</td>
                    <td>${hrInicio} às ${hrFim}</td>
                    <td style="text-align: right;">
                        <button class="btn btn-secondary btn-delete-recorrente" data-id="${bloq.id}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto; color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } else {
        html += `<tr><td colspan="4">Nenhum bloqueio fixo semanal configurado.</td></tr>`;
    }

    html += `           </tbody>
                    </table>
                </div>

            </div>
        </div>
    `;

    container.innerHTML = html;

    setupBloqueiosListeners(meusRecursos);
}

function setupBloqueiosListeners(meusRecursos) {
    // --- Tabs Switching ---
    const btnSectionP = document.getElementById('btnViewPeriodo');
    const btnSectionR = document.getElementById('btnViewRecorrente');
    const sectP = document.getElementById('sectionPeriodo');
    const sectR = document.getElementById('sectionRecorrente');

    btnSectionP.addEventListener('click', () => {
        btnSectionP.style.background = 'var(--primary-color)';
        btnSectionP.style.color = '#fff';
        btnSectionR.style.background = 'transparent';
        btnSectionR.style.color = 'var(--text-main)';
        sectP.style.display = 'block';
        sectR.style.display = 'none';
    });

    btnSectionR.addEventListener('click', () => {
        btnSectionR.style.background = 'var(--primary-color)';
        btnSectionR.style.color = '#fff';
        btnSectionP.style.background = 'transparent';
        btnSectionP.style.color = 'var(--text-main)';
        sectR.style.display = 'block';
        sectP.style.display = 'none';
    });

    // --- Helpers ---
    const setupCustomDropdown = (dropdownId, hiddenInputId) => {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;
        const selectedEl = dropdown.querySelector('.custom-dropdown-selected');
        const optionsList = dropdown.querySelectorAll('.custom-option:not(.disabled)');
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
            });
        });
    };

    document.addEventListener('click', () => {
        document.getElementById('bloqueiosRecursoDropdown')?.classList.remove('open');
        document.getElementById('recRecursoDropdown')?.classList.remove('open');
        document.getElementById('recDiaDropdown')?.classList.remove('open');
    });

    // --- BLOQUEIOS DE PERÍODO LOGIC ---
    if (window.flatpickr) {
        flatpickr('#bloqueioDataInicio, #bloqueioDataFim', {
            locale: "pt",
            enableTime: true,
            time_24hr: true,
            dateFormat: "Y-m-d H:i",
            disableMobile: true
        });
    }

    setupCustomDropdown('bloqueiosRecursoDropdown', 'bloqueioRecursoId');

    const formPeriodo = document.getElementById('formBloqueio');
    const btnNovoP = document.getElementById('btnNovoBloqueio');
    const containerPeriodo = document.getElementById('formContainerBloqueio');
    const titleP = document.getElementById('formBloqueioTitle');

    btnNovoP.addEventListener('click', () => {
        formPeriodo.reset();
        document.getElementById('bloqueioId').value = '';
        document.getElementById('bloqueioRecursoId').value = '';
        const dr = document.getElementById('bloqueiosRecursoDropdown');
        dr.querySelector('.selected-text').textContent = 'Escolha o recurso...';
        dr.querySelectorAll('.custom-option').forEach(o => o.classList.remove('active'));

        document.getElementById('bloqueioMsg').style.display = 'none';
        titleP.textContent = 'Inserir Bloqueio Único';
        containerPeriodo.classList.remove('hidden');
        containerPeriodo.scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('btnCancelarBloqueio').addEventListener('click', () => containerPeriodo.classList.add('hidden'));

    formPeriodo.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgInfo = document.getElementById('bloqueioMsg');
        const btnSalvar = document.getElementById('btnSalvarBloqueio');

        const id = document.getElementById('bloqueioId').value;
        const recursoId = document.getElementById('bloqueioRecursoId').value;
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
            msgInfo.textContent = "Erro: O calendário já possui um bloqueio nestas datas para este recurso.";
            msgInfo.style.display = 'block';
            return;
        }

        msgInfo.style.display = 'none';
        btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnSalvar.disabled = true;

        const payload = {
            empresa_id: window.dashboardContext.currentEmpresaId,
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
            const dr = document.getElementById('bloqueiosRecursoDropdown');
            const opt = dr.querySelector(`.custom-option[data-value="${recursoId}"]`);
            if (opt) {
                dr.querySelectorAll('.custom-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                dr.querySelector('.selected-text').textContent = opt.textContent;
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

            titleP.textContent = 'Editar Bloqueio Único';
            containerPeriodo.classList.remove('hidden');
            containerPeriodo.scrollIntoView({ behavior: 'smooth' });
        });
    });

    document.querySelectorAll('.btn-delete-bloqueio').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const confirmado = await window.showConfirmModal('Remover Bloqueio', 'Tem a certeza que deseja remover este bloqueio e repôr a disponibilidade?');
            if (confirmado) {
                const { error } = await window.supabase.from('bloqueios_disponibilidade').delete().eq('id', id);
                if (error) window.showAlertModal('Erro', 'Erro a eliminar: ' + error.message);
                else setTimeout(() => document.querySelector('[data-view="bloqueios"]').click(), 0);
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
            if (start < re && end > rs) return true;
        }
        return false;
    }


    // --- BLOQUEIOS RECORRENTES LOGIC ---
    if (window.flatpickr) {
        flatpickr('#recHoraInicio, #recHoraFim', {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: true,
            disableMobile: true
        });
    }

    setupCustomDropdown('recRecursoDropdown', 'recRecursoId');
    setupCustomDropdown('recDiaDropdown', 'recDiaSemana');

    const formRec = document.getElementById('formRecorrente');
    const containerRec = document.getElementById('formContainerRecorrente');

    document.getElementById('btnNovoRecorrente').addEventListener('click', () => {
        formRec.reset();
        document.getElementById('recRecursoId').value = '';
        document.getElementById('recDiaSemana').value = '';

        const drR = document.getElementById('recRecursoDropdown');
        drR.querySelector('.selected-text').textContent = 'Escolha o recurso...';
        drR.querySelectorAll('.custom-option').forEach(o => o.classList.remove('active'));

        const drD = document.getElementById('recDiaDropdown');
        drD.querySelector('.selected-text').textContent = 'Escolha o dia...';
        drD.querySelectorAll('.custom-option').forEach(o => o.classList.remove('active'));

        containerRec.classList.remove('hidden');
        containerRec.scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('btnCancelarRecorrente').addEventListener('click', () => containerRec.classList.add('hidden'));

    formRec.addEventListener('submit', async (e) => {
        e.preventDefault();

        const recursoId = document.getElementById('recRecursoId').value;
        const diaSemana = document.getElementById('recDiaSemana').value;
        const horaInicio = document.getElementById('recHoraInicio').value;
        const horaFim = document.getElementById('recHoraFim').value;

        if (!recursoId || diaSemana === '') {
            window.showAlertModal('Erro', 'Por favor preencha todos os campos.');
            return;
        }

        const btnSalvar = document.getElementById('btnSalvarRecorrente');
        btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnSalvar.disabled = true;

        const payload = {
            empresa_id: window.dashboardContext.currentEmpresaId,
            recurso_id: recursoId,
            dia_semana: parseInt(diaSemana),
            hora_inicio: horaInicio + ':00',
            hora_fim: horaFim + ':00'
        };

        const { error } = await window.supabase.from('bloqueios_recorrentes').insert([payload]);

        btnSalvar.innerHTML = 'Salvar Horário';
        btnSalvar.disabled = false;

        if (error) {
            window.showAlertModal('Erro', 'Erro ao salvar: ' + error.message);
        } else {
            setTimeout(() => document.querySelector('[data-view="bloqueios"]').click(), 0);
        }
    });

    document.querySelectorAll('.btn-delete-recorrente').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const confirmado = await window.showConfirmModal('Remover Bloqueio', 'Remover este bloqueio fixo da semana?');
            if (confirmado) {
                const { error } = await window.supabase.from('bloqueios_recorrentes').delete().eq('id', id);
                if (error) window.showAlertModal('Erro', 'Erro a eliminar: ' + error.message);
                else setTimeout(() => document.querySelector('[data-view="bloqueios"]').click(), 0);
            }
        });
    });

}

function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
}
