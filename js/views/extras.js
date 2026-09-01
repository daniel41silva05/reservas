export async function renderExtras(container, session) {
    const empId = window.dashboardContext.currentEmpresaId;

    if (!empId) {
        container.innerHTML = `<div class="glass-panel" style="padding: 2rem; text-align: center;"><p class="text-sub">Por favor, escolha ou crie uma empresa primeiro.</p></div>`;
        return;
    }

    // Carrega Extras da empresa com o nome do recurso
    const { data: extras, error } = await window.supabase
        .from('extras')
        .select(`
            *,
            recursos(nome)
        `)
        .eq('empresa_id', empId)
        .order('titulo', { ascending: true });

    // Para o formulário, precisamos dos recursos
    const { data: meusRecursos } = await window.supabase
        .from('recursos')
        .select('id, nome, empresa_id')
        .eq('empresa_id', empId)
        .eq('ativo', true);

    if (error) {
        container.innerHTML = `<div class="glass-panel" style="padding: 2rem; color: var(--danger);">Erro a carregar extras: ${error.message}</div>`;
        return;
    }

    let html = `
        <div class="glass-panel" style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div>
                    <h3>Gestão de Extras</h3>
                    <p class="text-sub" style="font-size: 0.85rem;">Defina extras (opções adicionais) para um recurso (ex: Cama Extra, Pequeno Almoço).</p>
                </div>
                <button class="btn btn-primary" id="btnNovoExtra" style="padding: 0.5rem 1rem; font-size: 0.85rem;"><i class="fa-solid fa-plus"></i> Novo Extra</button>
            </div>

            <!-- FILTERS TOGGLE BUTTON -->
            <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
                <button id="btnToggleFilters" class="btn btn-secondary" style="font-size: 0.85rem; padding: 0.5rem 1rem;">
                    <i class="fa-solid fa-filter"></i> Mostrar Filtro
                </button>
            </div>

            <!-- FILTERS CONTAINER -->
            <div id="filtersContainer" class="hidden" style="background: rgba(0,0,0,0.15); padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid rgba(255,255,255,0.05);">
                <h5 style="margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-secondary);">Filtro de Pesquisa</h5>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; align-items: end;">
                    <div class="form-group mb-0" style="display: flex; flex-direction: column;">
                        <label style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem; display: block;">Pesquisa Livre</label>
                        <input type="text" id="filterBuscaLivre" class="form-control" placeholder="Título, tipo, preço..." style="padding: 0.75rem 1rem; height: 100%; box-sizing: border-box;">
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
                                ${meusRecursos ? meusRecursos.map(r => `<div class="custom-option" data-value="${escapeHTML(r.nome)}">${escapeHTML(r.nome)}</div>`).join('') : ''}
                            </div>
                        </div>
                    </div>
                    <div class="form-group mb-0" style="display: flex;">
                        <button type="button" id="btnLimparFiltros" class="btn btn-secondary" style="width: 100%; padding: 0.75rem 1rem;"><i class="fa-solid fa-eraser"></i> Limpar Filtro</button>
                    </div>
                </div>
            </div>

            <!-- Formulário Novo/Editar Extra -->
            <div id="formContainerExtra" class="hidden" style="margin-bottom: 2rem; padding: 1.5rem; border: 1px solid var(--border-color); border-radius: 8px; background: rgba(0,0,0,0.2);">
                <h4 id="formExtraTitle" style="margin-bottom: 1rem;">Adicionar Extra</h4>
                <form id="formExtra">
                    <input type="hidden" id="extraId" value="">
                    
                    <div style="display: flex; gap: 1rem; align-items: stretch; margin-bottom: 1.5rem; flex-wrap: wrap;">
                        <div class="form-group" style="flex: 1; min-width: 250px; margin: 0; display: flex; flex-direction: column;">
                            <label>Recursos Alvo</label>
                            <div id="extrasRecursosCheckboxes" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 150px; overflow-y: auto; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 8px; background: rgba(0,0,0,0.1);">
                                ${meusRecursos && meusRecursos.length > 0
            ? meusRecursos.map(r => `
                                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem; margin: 0;">
                                        <input type="checkbox" name="extraRecursoIds" value="${r.id}" style="accent-color: var(--primary-color);">
                                        <span>${escapeHTML(r.nome)}</span>
                                    </label>
                                `).join('')
            : `<div class="text-sub" style="font-size: 0.9rem;">Nenhum recurso encontrado na empresa.</div>`}
                            </div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                        <div class="form-group">
                            <label>Título</label>
                            <input type="text" id="extraTitulo" class="form-control" required placeholder="">
                        </div>
                        <div class="form-group">
                            <label>Tipo</label>
                            <input type="text" id="extraTipo" class="form-control" required placeholder="">
                        </div>
                        <div class="form-group">
                            <label>Preço por Noite (€)</label>
                            <input type="number" step="0.01" min="0" id="extraValor" class="form-control" required placeholder="">
                        </div>
                    </div>

                    <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" id="btnCancelarExtra">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btnSalvarExtra">Salvar Extra</button>
                    </div>
                    <p id="extraMsg" class="error-msg" style="margin-top: 1rem; display: none;"></p>
                </form>
            </div>

            <div class="data-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Recurso</th>
                            <th>Título</th>
                            <th>Tipo</th>
                            <th>Preço/Noite</th>
                            <th style="text-align: right;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (extras && extras.length > 0) {
        extras.forEach(ext => {
            const recursoNome = ext.recursos ? ext.recursos.nome : 'Recurso Removido';

            html += `
                <tr class="extra-row" data-recurso="${escapeHTML(recursoNome)}">
                    <td><strong>${escapeHTML(recursoNome)}</strong></td>
                    <td>${escapeHTML(ext.titulo)}</td>
                    <td>${escapeHTML(ext.tipo)}</td>
                    <td><span class="badge badge-success">${parseFloat(ext.preco).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span></td>
                    <td style="text-align: right;">
                        <button class="btn btn-secondary btn-edit-extra" data-id="${ext.id}" data-recurso="${ext.recurso_id}" data-titulo="${escapeHTML(ext.titulo)}" data-tipo="${escapeHTML(ext.tipo)}" data-preco="${ext.preco}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto;"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-secondary btn-delete-extra" data-id="${ext.id}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto; color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } else {
        html += `<tr><td colspan="5">Nenhum extra configurado.</td></tr>`;
    }

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;

    setupExtrasListeners();
}

function setupExtrasListeners() {
    const mainForm = document.getElementById('formExtra');
    if (!mainForm) return;

    const btnNovo = document.getElementById('btnNovoExtra');
    const formContainer = document.getElementById('formContainerExtra');
    const btnCancelar = document.getElementById('btnCancelarExtra');
    const title = document.getElementById('formExtraTitle');



    // Toggle Formulário
    btnNovo.addEventListener('click', () => {
        mainForm.reset();
        document.getElementById('extraId').value = '';
        document.querySelectorAll('input[name="extraRecursoIds"]').forEach(cb => cb.checked = false);
        document.getElementById('extraMsg').style.display = 'none';
        title.textContent = 'Adicionar novo Extra';
        formContainer.classList.remove('hidden');
        formContainer.scrollIntoView({ behavior: 'smooth' });
    });

    btnCancelar.addEventListener('click', () => {
        formContainer.classList.add('hidden');
    });

    // Submissão (Create / Update)
    mainForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgInfo = document.getElementById('extraMsg');
        const btnSalvar = document.getElementById('btnSalvarExtra');

        const id = document.getElementById('extraId').value;
        const recursoIds = Array.from(document.querySelectorAll('input[name="extraRecursoIds"]:checked')).map(cb => cb.value);
        const titulo = document.getElementById('extraTitulo').value;
        const tipo = document.getElementById('extraTipo').value;
        const preco = document.getElementById('extraValor').value;
        const empresaId = window.dashboardContext.currentEmpresaId;

        if (recursoIds.length === 0) {
            msgInfo.textContent = "Erro: Selecione pelo menos um recurso.";
            msgInfo.style.display = 'block';
            return;
        }

        msgInfo.style.display = 'none';
        btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnSalvar.disabled = true;

        let reqError;

        if (id) {
            const payload = {
                empresa_id: empresaId,
                recurso_id: recursoIds[0],
                titulo: titulo,
                tipo: tipo,
                preco: parseFloat(preco)
            };
            const { error } = await window.supabase.from('extras').update(payload).eq('id', id);
            reqError = error;
        } else {
            const payloads = recursoIds.map(rId => ({
                empresa_id: empresaId,
                recurso_id: rId,
                titulo: titulo,
                tipo: tipo,
                preco: parseFloat(preco)
            }));
            const { error } = await window.supabase.from('extras').insert(payloads);
            reqError = error;
        }

        btnSalvar.innerHTML = 'Salvar Extra';
        btnSalvar.disabled = false;

        if (reqError) {
            msgInfo.textContent = "Erro: " + reqError.message;
            msgInfo.style.display = 'block';
        } else {
            setTimeout(() => document.querySelector('[data-view="extras"]').click(), 0); // Recarregar
        }
    });

    // Editar e Apagar
    document.querySelectorAll('.btn-edit-extra').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.currentTarget;
            document.getElementById('extraId').value = btnEl.getAttribute('data-id');
            const recursoId = btnEl.getAttribute('data-recurso');
            document.querySelectorAll('input[name="extraRecursoIds"]').forEach(cb => {
                cb.checked = cb.value === recursoId;
            });

            document.getElementById('extraTitulo').value = btnEl.getAttribute('data-titulo');
            document.getElementById('extraTipo').value = btnEl.getAttribute('data-tipo');
            document.getElementById('extraValor').value = btnEl.getAttribute('data-preco');

            title.textContent = 'Editar Extra';
            formContainer.classList.remove('hidden');
            formContainer.scrollIntoView({ behavior: 'smooth' });
        });
    });

    document.querySelectorAll('.btn-delete-extra').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const confirmado = await window.showConfirmModal('Apagar Extra', 'Tem a certeza que deseja apagar este extra?');
            if (confirmado) {
                const { error } = await window.supabase.from('extras').delete().eq('id', id);
                if (error) {
                    window.showAlertModal('Erro', 'Erro a eliminar: ' + error.message);
                } else {
                    setTimeout(() => document.querySelector('[data-view="extras"]').click(), 0);
                }
            }
        });
    });

    // Filter logic UI setup
    const applyFilters = () => {
        const fRecurso = document.getElementById('filterRecurso').value.toLowerCase();
        const fBusca = (document.getElementById('filterBuscaLivre')?.value || '').toLowerCase();

        document.querySelectorAll('.data-table-container tbody tr.extra-row').forEach(tr => {
            const recurso = (tr.getAttribute('data-recurso') || '').toLowerCase();
            const titulo = (tr.querySelector('td:nth-child(2)')?.textContent || '').toLowerCase();
            const tipo = (tr.querySelector('td:nth-child(3)')?.textContent || '').toLowerCase();
            const preco = (tr.querySelector('td:nth-child(4)')?.textContent || '').toLowerCase();

            let show = true;
            if (fRecurso && recurso !== fRecurso) show = false;
            
            if (fBusca && !(recurso.includes(fBusca) || titulo.includes(fBusca) || tipo.includes(fBusca) || preco.includes(fBusca))) {
                show = false;
            }

            tr.style.display = show ? '' : 'none';
        });
    };

    document.getElementById('filterBuscaLivre')?.addEventListener('input', applyFilters);

    const btnToggleF = document.getElementById('btnToggleFilters');
    const fContainer = document.getElementById('filtersContainer');
    if (btnToggleF) {
        btnToggleF.addEventListener('click', () => {
            fContainer.classList.toggle('hidden');
            if (fContainer.classList.contains('hidden')) {
                btnToggleF.innerHTML = '<i class="fa-solid fa-filter"></i> Mostrar Filtro';
            } else {
                btnToggleF.innerHTML = '<i class="fa-solid fa-filter"></i> Ocultar Filtro';
            }
        });
    }

    const setDropdownFilter = (dropdownId, hiddenInputId) => {
        const dropEl = document.getElementById(dropdownId);
        if (!dropEl) return;
        const selectedEl = dropEl.querySelector('.custom-dropdown-selected');
        const optionsList = dropEl.querySelectorAll('.custom-option');
        const textEl = dropEl.querySelector('.selected-text');
        const hiddenInput = document.getElementById(hiddenInputId);

        selectedEl.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-dropdown.open').forEach(d => {
                if (d !== dropEl) d.classList.remove('open');
            });
            dropEl.classList.toggle('open');
        });

        optionsList.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                optionsList.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                textEl.textContent = opt.textContent;
                dropEl.classList.remove('open');
                hiddenInput.value = opt.getAttribute('data-value');
                applyFilters();
            });
        });
    };

    setDropdownFilter('filterRecursoDropdown', 'filterRecurso');

    document.getElementById('btnLimparFiltros')?.addEventListener('click', () => {
        document.getElementById('filterRecurso').value = '';
        const inputBusca = document.getElementById('filterBuscaLivre');
        if(inputBusca) inputBusca.value = '';
        
        const recDrop = document.getElementById('filterRecursoDropdown');
        if (recDrop) {
            recDrop.querySelectorAll('.custom-option').forEach(o => o.classList.remove('active'));
            const first = recDrop.querySelector('.custom-option');
            if (first) {
                first.classList.add('active');
                recDrop.querySelector('.selected-text').textContent = first.textContent;
            }
        }
        applyFilters();
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-dropdown.open').forEach(d => d.classList.remove('open'));
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
