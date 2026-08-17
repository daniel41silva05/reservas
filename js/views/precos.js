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
                    <h3>Gestão de Preços (Sazonal)</h3>
                    <p class="text-sub" style="font-size: 0.85rem;">Defina o preço base para um recurso numa determinada época.</p>
                </div>
                <button class="btn btn-primary" id="btnNovoPreco" style="padding: 0.5rem 1rem; font-size: 0.85rem;"><i class="fa-solid fa-plus"></i> Novo Preço</button>
            </div>

            <!-- Formulário Novo/Editar Preço -->
            <div id="formContainerPreco" class="hidden" style="margin-bottom: 2rem; padding: 1.5rem; border: 1px solid var(--border-color); border-radius: 8px; background: rgba(0,0,0,0.2);">
                <h4 id="formPrecoTitle" style="margin-bottom: 1rem;">Definir Época de Preço</h4>
                <form id="formPreco">
                    <input type="hidden" id="precoId" value="">
                    
                    <div style="margin-bottom: 1rem;">
                        <div class="form-group">
                            <label>Recurso Alvo</label>
                            <select id="precoRecursoId" class="form-control" required>
                                <option value="" disabled selected>Escolha o recurso...</option>
                                ${meusRecursos && meusRecursos.length > 0
            ? meusRecursos.map(r => `<option value="${r.id}">${escapeHTML(r.nome)}</option>`).join('')
            : `<option value="" disabled>Nenhum recurso encontrado na empresa.</option>`}
                            </select>
                        </div>
                    </div>

                    <div style="margin-bottom: 1rem;">
                        <input type="checkbox" id="precoIsDefault" style="margin-right: 0.5rem; vertical-align: middle;">
                        <label for="precoIsDefault" style="display: inline-block; vertical-align: middle; cursor: pointer;">Preço Default (para todo o ano, sem restrição de datas)</label>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div class="form-group" id="groupDataInicio">
                            <label>Data de Início</label>
                            <input type="date" id="precoDataInicio" class="form-control">
                        </div>
                        <div class="form-group" id="groupDataFim">
                            <label>Data de Fim</label>
                            <input type="date" id="precoDataFim" class="form-control">
                        </div>
                        <div class="form-group">
                            <label>Preço Base (Em €)</label>
                            <input type="number" step="0.01" min="0" id="precoValor" class="form-control" required placeholder="50.00">
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
            groupDataInicio.style.display = 'block';
            groupDataFim.style.display = 'block';
        }
    });

    // Toggle Formulário
    btnNovo.addEventListener('click', () => {
        mainForm.reset();
        document.getElementById('precoId').value = '';
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
            document.getElementById('precoRecursoId').value = btnEl.getAttribute('data-recurso');

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
            if (confirm('Tem a certeza que apagar esta época de preços?')) {
                const { error } = await window.supabase.from('precos').delete().eq('id', id);
                if (error) {
                    alert('Erro a eliminar: ' + error.message);
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
