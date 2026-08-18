export async function renderPrecos(container, session) {
    const empId = window.dashboardContext.currentEmpresaId;

    if (!empId) {
        container.innerHTML = `<div class="glass-panel" style="padding: 2rem; text-align: center;"><p class="text-sub">Por favor, escolha ou crie uma empresa primeiro.</p></div>`;
        return;
    }

    // Carrega Preços da empresa com o nome do recurso
    const { data: precos, error } = await window.supabase
        .from('precos')
        .select(`
            *,
            recursos(nome)
        `)
        .eq('empresa_id', empId)
        .order('data_inicio', { ascending: true });

    // Para o formulário, precisamos dos recursos
    const { data: meusRecursos } = await window.supabase
        .from('recursos')
        .select('id, nome, empresa_id')
        .eq('empresa_id', empId)
        .eq('ativo', true);

    if (error) {
        container.innerHTML = `<div class="glass-panel" style="padding: 2rem; color: var(--danger);">Erro a carregar preços: ${error.message}</div>`;
        return;
    }

    let html = `
        <div class="glass-panel" style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div>
                    <h3>Gestão de Preços</h3>
                    <p class="text-sub" style="font-size: 0.85rem;">Defina o preço base para um recurso numa determinada época.</p>
                </div>
                <button class="btn btn-primary" id="btnNovoPreco" style="padding: 0.5rem 1rem; font-size: 0.85rem;"><i class="fa-solid fa-plus"></i> Novo Preço</button>
            </div>

            <!-- Formulário Novo/Editar Preço -->
            <div id="formContainerPreco" class="hidden" style="margin-bottom: 2rem; padding: 1.5rem; border: 1px solid var(--border-color); border-radius: 8px; background: rgba(0,0,0,0.2);">
                <h4 id="formPrecoTitle" style="margin-bottom: 1rem;">Definir Época de Preço</h4>
                <form id="formPreco">
                    <input type="hidden" id="precoId" value="">
                    
                    <div style="display: flex; gap: 1rem; align-items: stretch; margin-bottom: 1.5rem; flex-wrap: wrap;">
                        <div class="form-group" style="flex: 1; min-width: 250px; margin: 0; display: flex; flex-direction: column;">
                            <label>Recurso Alvo</label>
                            <input type="hidden" id="precoRecursoId" value="">
                            <div class="custom-dropdown" id="precosRecursoDropdown" style="width: 100%;">
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

                        <div class="form-group" style="margin: 0; min-width: 250px; display: flex; flex-direction: column;">
                            <label style="visibility: hidden;">Tipo de Preço</label>
                            <label for="precoIsDefault" class="form-control" style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; margin: 0; padding: 0.9rem 1.2rem; box-sizing: border-box; flex: 1;">
                                <input type="checkbox" id="precoIsDefault" style="margin: 0; width: 1.2rem; height: 1.2rem; cursor: pointer; accent-color: var(--primary-color);">
                                <span style="font-weight: 500; font-size: 0.95rem; white-space: nowrap; margin-bottom: 0;">Preço Global (Todo o ano)</span>
                            </label>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                        <div class="form-group">
                            <label>Preço Base (Em €)</label>
                            <input type="number" step="0.01" min="0" id="precoValor" class="form-control" required placeholder="50.00">
                        </div>
                        <div class="form-group" id="groupDataInicio">
                            <label>Data de Início</label>
                            <div style="position: relative; display: flex; align-items: center;">
                                <input type="text" id="precoDataInicio" class="form-control" placeholder="Selecione a data inicial">
                                <i class="fa-regular fa-calendar" style="position: absolute; right: 15px; color: var(--text-muted); pointer-events: none; font-size: 1.1rem;"></i>
                            </div>
                        </div>
                        <div class="form-group" id="groupDataFim">
                            <label>Data de Fim</label>
                            <div style="position: relative; display: flex; align-items: center;">
                                <input type="text" id="precoDataFim" class="form-control" placeholder="Selecione a data final">
                                <i class="fa-regular fa-calendar" style="position: absolute; right: 15px; color: var(--text-muted); pointer-events: none; font-size: 1.1rem;"></i>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" id="btnCancelarPreco">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btnSalvarPreco">Salvar Época</button>
                    </div>
                    <p id="precoMsg" class="error-msg" style="margin-top: 1rem;"></p>
                </form>
            </div>

            <div class="data-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Recurso</th>
                            <th>Período</th>
                            <th>Valor Base</th>
                            <th style="text-align: right;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (precos && precos.length > 0) {
        precos.forEach(prec => {
            const recursoNome = prec.recursos ? prec.recursos.nome : 'Recurso Removido';
            const dataI = prec.data_inicio ? new Date(prec.data_inicio).toLocaleDateString('pt-PT') : '';
            const dataF = prec.data_fim ? new Date(prec.data_fim).toLocaleDateString('pt-PT') : '';
            const periodoStr = prec.data_inicio ? `${dataI} a ${dataF}` : '<strong>Preço Global (Padrão)</strong>';

            html += `
                <tr>
                    <td><strong>${escapeHTML(recursoNome)}</strong></td>
                    <td>${periodoStr}</td>
                    <td><span class="badge badge-success">${parseFloat(prec.preco_base).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span></td>
                    <td style="text-align: right;">
                        <button class="btn btn-secondary btn-edit-preco" data-id="${prec.id}" data-empresa="${prec.empresa_id}" data-recurso="${prec.recurso_id}" data-inicio="${prec.data_inicio || ''}" data-fim="${prec.data_fim || ''}" data-preco="${prec.preco_base}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto;"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-secondary btn-delete-preco" data-id="${prec.id}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto; color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } else {
        html += `<tr><td colspan="4">Nenhuma regra de preço configurada.</td></tr>`;
    }

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;

    setupPrecosListeners(meusRecursos);
}

function setupPrecosListeners(meusRecursos) {
    const mainForm = document.getElementById('formPreco');
    if (!mainForm) return;

    // Initialize custom date pickers
    if (window.flatpickr) {
        flatpickr('#precoDataInicio, #precoDataFim', {
            locale: "pt",
            dateFormat: "Y-m-d",
            disableMobile: true // Ensures custom picker even on mobile devices
        });
    }

    const btnNovo = document.getElementById('btnNovoPreco');
    const formContainer = document.getElementById('formContainerPreco');
    const btnCancelar = document.getElementById('btnCancelarPreco');
    const title = document.getElementById('formPrecoTitle');
    const selectRecurso = document.getElementById('precoRecursoId');
    const chkDefault = document.getElementById('precoIsDefault');
    const groupDataInicio = document.getElementById('groupDataInicio');
    const groupDataFim = document.getElementById('groupDataFim');

    // Toggle Input visibility based on Default Checkbox
    chkDefault.addEventListener('change', (e) => {
        if (e.target.checked) {
            groupDataInicio.style.display = 'none';
            groupDataFim.style.display = 'none';
        } else {
            groupDataInicio.style.display = '';
            groupDataFim.style.display = '';
        }
    });

    // Custom Dropdown Logic
    const dropdown = document.getElementById('precosRecursoDropdown');
    if (dropdown) {
        const selectedEl = dropdown.querySelector('.custom-dropdown-selected');
        const optionsList = dropdown.querySelectorAll('.custom-option:not(.disabled)');
        const textEl = dropdown.querySelector('.selected-text');
        const hiddenInput = document.getElementById('precoRecursoId');

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

    // Toggle Formulário
    btnNovo.addEventListener('click', () => {
        mainForm.reset();
        document.getElementById('precoId').value = '';
        document.getElementById('precoRecursoId').value = '';
        if (dropdown) {
            dropdown.querySelector('.selected-text').textContent = 'Escolha o recurso...';
            dropdown.querySelectorAll('.custom-option').forEach(o => o.classList.remove('active'));
        }
        document.getElementById('precoMsg').style.display = 'none';
        chkDefault.checked = false;
        chkDefault.dispatchEvent(new Event('change'));
        title.textContent = 'Adicionar novo preço';
        formContainer.classList.remove('hidden');
        formContainer.scrollIntoView({ behavior: 'smooth' });
    });

    btnCancelar.addEventListener('click', () => {
        formContainer.classList.add('hidden');
    });

    // Submissão (Create / Update)
    mainForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgInfo = document.getElementById('precoMsg');
        const btnSalvar = document.getElementById('btnSalvarPreco');

        const id = document.getElementById('precoId').value;
        const recursoId = document.getElementById('precoRecursoId').value;
        const dataInicio = document.getElementById('precoDataInicio').value;
        const dataFim = document.getElementById('precoDataFim').value;
        const precoBase = document.getElementById('precoValor').value;
        const isDefault = document.getElementById('precoIsDefault').checked;
        const empresaId = window.dashboardContext.currentEmpresaId;

        if (!recursoId) {
            msgInfo.textContent = "Erro: Selecione um recurso da empresa.";
            msgInfo.style.display = 'block';
            return;
        }

        if (!isDefault) {
            if (!dataInicio || !dataFim) {
                msgInfo.textContent = "Erro: Defina a data inicial e final ou marque como Peço Default.";
                msgInfo.style.display = 'block';
                return;
            }
            if (new Date(dataFim) < new Date(dataInicio)) {
                msgInfo.textContent = "Erro: A data final não pode ser antes da inicial.";
                msgInfo.style.display = 'block';
                return;
            }
        }

        const isOverlap = await checkOverlaps(id, recursoId, isDefault ? null : dataInicio, isDefault ? null : dataFim);
        if (isOverlap) {
            if (isDefault) {
                msgInfo.textContent = "Erro: Já existe um preço default para este recurso.";
            } else {
                msgInfo.textContent = "Erro: As datas coincidem com outra configuração de preço para este recurso. Verifique as concorrências.";
            }
            msgInfo.style.display = 'block';
            return;
        }

        msgInfo.style.display = 'none';
        btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnSalvar.disabled = true;

        const payload = {
            empresa_id: empresaId,
            recurso_id: recursoId,
            data_inicio: isDefault ? null : dataInicio,
            data_fim: isDefault ? null : dataFim,
            preco_base: parseFloat(precoBase)
        };

        let reqError;

        if (id) {
            const { error } = await window.supabase.from('precos').update(payload).eq('id', id);
            reqError = error;
        } else {
            const { error } = await window.supabase.from('precos').insert([payload]);
            reqError = error;
        }

        btnSalvar.innerHTML = 'Salvar Época';
        btnSalvar.disabled = false;

        if (reqError) {
            msgInfo.textContent = "Erro: " + reqError.message;
            msgInfo.style.display = 'block';
        } else {
            setTimeout(() => document.querySelector('[data-view="precos"]').click(), 0); // Recarregar
        }
    });

    // Editar e Apagar
    document.querySelectorAll('.btn-edit-preco').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.currentTarget;
            document.getElementById('precoId').value = btnEl.getAttribute('data-id');
            const recursoId = btnEl.getAttribute('data-recurso');
            document.getElementById('precoRecursoId').value = recursoId;

            if (dropdown) {
                const opt = dropdown.querySelector(`.custom-option[data-value="${recursoId}"]`);
                if (opt) {
                    dropdown.querySelectorAll('.custom-option').forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    dropdown.querySelector('.selected-text').textContent = opt.textContent;
                }
            }

            const dataInicio = btnEl.getAttribute('data-inicio');
            const dataFim = btnEl.getAttribute('data-fim');

            document.getElementById('precoDataInicio').value = dataInicio;
            document.getElementById('precoDataFim').value = dataFim;

            const chkDefault = document.getElementById('precoIsDefault');
            chkDefault.checked = !dataInicio && !dataFim;
            chkDefault.dispatchEvent(new Event('change'));
            document.getElementById('precoValor').value = btnEl.getAttribute('data-preco');

            title.textContent = 'Editar Época de Preço';
            formContainer.classList.remove('hidden');
            formContainer.scrollIntoView({ behavior: 'smooth' });
        });
    });

    document.querySelectorAll('.btn-delete-preco').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const confirmado = await window.showConfirmModal('Apagar Preço', 'Tem a certeza que deseja apagar esta época de preços?');
            if (confirmado) {
                const { error } = await window.supabase.from('precos').delete().eq('id', id);
                if (error) {
                    window.showAlertModal('Erro', 'Erro a eliminar: ' + error.message);
                } else {
                    setTimeout(() => document.querySelector('[data-view="precos"]').click(), 0);
                }
            }
        });
    });

    async function checkOverlaps(editId, recursoId, startStr, endStr) {
        const { data } = await window.supabase.from('precos')
            .select('id, data_inicio, data_fim')
            .eq('recurso_id', recursoId);

        if (!data) return false;

        if (!startStr || !endStr) {
            // It's a default price; check if any other default price exists
            for (let r of data) {
                if (editId && r.id == editId) continue;
                if (!r.data_inicio && !r.data_fim) return true;
            }
            return false;
        }

        // Standard overlap logic
        const start = new Date(startStr);
        const end = new Date(endStr);

        for (let r of data) {
            if (editId && r.id == editId) continue;
            if (!r.data_inicio || !r.data_fim) continue; // skip default prices
            let rs = new Date(r.data_inicio);
            let re = new Date(r.data_fim);
            if (start <= re && end >= rs) return true;
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
