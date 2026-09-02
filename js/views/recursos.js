export async function renderRecursos(container, session) {
    const empId = window.dashboardContext.currentEmpresaId;
    const empName = window.dashboardContext.currentEmpresaName;
    const empTipo = window.dashboardContext.currentEmpresaTipo;

    if (!empId) {
        container.innerHTML = `<div class="glass-panel" style="padding: 2rem; text-align: center;"><p class="text-sub">Por favor, escolha ou crie uma empresa primeiro.</p></div>`;
        return;
    }

    // Carrega Recursos da empresa
    const { data: recursos, error } = await window.supabase
        .from('recursos')
        .select('*')
        .eq('empresa_id', empId)
        .order('id', { ascending: false });

    if (error) {
        container.innerHTML = `<div class="glass-panel" style="padding: 2rem; color: var(--danger);">Erro a carregar recursos: ${error.message}</div>`;
        return;
    }

    let html = `
        <div class="glass-panel" style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div>
                    <h3>Lista de Recursos</h3>
                    <p class="text-sub" style="font-size: 0.85rem;">Adicione os itens, espaços ou profissionais que estarão disponíveis para reserva.</p>
                </div>
                <button class="btn btn-primary" id="btnNovoRecurso" style="padding: 0.5rem 1rem; font-size: 0.85rem;"><i class="fa-solid fa-plus"></i> Novo Recurso</button>
            </div>

            <!-- Formulário Novo/Editar Recurso -->
            <div id="formContainerRecurso" class="hidden" style="margin-bottom: 2rem; padding: 1.5rem; border: 1px solid var(--border-color); border-radius: 8px; background: rgba(0,0,0,0.2);">
                <h4 id="formRecursoTitle" style="margin-bottom: 1rem;">Adicionar novo recurso</h4>
                <form id="formRecurso">
                    <input type="hidden" id="recursoId" value="">
                    
                    <div style="display: flex; gap: 1rem; align-items: stretch; margin-bottom: 1.5rem; flex-wrap: wrap;">
                        <div class="form-group" style="flex: 1; min-width: 250px; margin: 0; display: flex; flex-direction: column;">
                            <label>Nome do Recurso</label>
                            <input type="text" id="recursoNome" class="form-control" required placeholder="Nome do recurso..." style="flex: 1; box-sizing: border-box;">
                        </div>
                        
                        ${empTipo === 'hotel' ? `
                        <div class="form-group" style="flex: 1; min-width: 200px; margin: 0; display: flex; flex-direction: column;">
                            <label>Nº Mín. Noites</label>
                            <input type="number" id="recursoMinNights" class="form-control" min="1" step="1" value="1" required style="flex: 1; box-sizing: border-box;">
                        </div>
                        ` : ''}

                        <div class="form-group" style="margin: 0; min-width: 200px; display: flex; flex-direction: column;">
                            <label style="visibility: hidden;">Estado</label>
                            <label for="recursoAtivo" class="form-control" style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer; margin: 0; padding: 0.9rem 1.2rem; box-sizing: border-box; flex: 1;">
                                <input type="checkbox" id="recursoAtivo" checked style="margin: 0; width: 1.2rem; height: 1.2rem; cursor: pointer; accent-color: var(--primary-color);">
                                <span style="font-weight: 500; font-size: 1rem; white-space: nowrap; margin-bottom: 0;">Ativo (Disponível)</span>
                            </label>
                        </div>
                    </div>

                    <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" id="btnCancelarRecurso">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btnSalvarRecurso">Salvar</button>
                    </div>
                    <p id="recursoMsg" class="error-msg" style="margin-top: 1rem;"></p>
                </form>
            </div>

            <div class="data-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Empresa</th>
                            ${empTipo === 'hotel' ? '<th>Mín. Noites</th>' : ''}
                            <th>Status</th>
                            <th style="text-align: right;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (recursos && recursos.length > 0) {
        recursos.forEach(rec => {
            const badgeClass = rec.ativo ? 'badge-success' : 'badge-warning';
            const statusTxt = rec.ativo ? 'Ativo' : 'Inativo';
            html += `
                <tr>
                    <td><strong>${escapeHTML(rec.nome)}</strong></td>
                    <td>${escapeHTML(empName)}</td>
                    ${empTipo === 'hotel' ? `<td>${rec.min_nights || 1}</td>` : ''}
                    <td><span class="badge ${badgeClass}">${statusTxt}</span></td>
                    <td style="text-align: right;">
                        <button class="btn btn-secondary btn-edit-recurso" data-id="${rec.id}" data-nome="${escapeHTML(rec.nome)}" data-min-nights="${rec.min_nights || 1}" data-empresa="${rec.empresa_id}" data-ativo="${rec.ativo}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto;"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-secondary btn-delete-recurso" data-id="${rec.id}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto; color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } else {
        html += `<tr><td colspan="4">Nenhum recurso encontrado. Crie um recurso para a sua empresa.</td></tr>`;
    }

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;

    setupRecursosListeners();
}

function setupRecursosListeners() {
    const mainForm = document.getElementById('formRecurso');
    if (!mainForm) return;

    const btnNovo = document.getElementById('btnNovoRecurso');
    const formContainer = document.getElementById('formContainerRecurso');
    const btnCancelar = document.getElementById('btnCancelarRecurso');
    const title = document.getElementById('formRecursoTitle');

    // Toggle Formulário
    btnNovo.addEventListener('click', () => {
        mainForm.reset();
        document.getElementById('recursoId').value = '';
        document.getElementById('recursoAtivo').checked = true;
        if (document.getElementById('recursoMinNights')) {
            document.getElementById('recursoMinNights').value = '1';
        }
        document.getElementById('recursoMsg').style.display = 'none';
        title.textContent = 'Adicionar novo recurso';
        formContainer.classList.toggle('hidden');
    });

    btnCancelar.addEventListener('click', () => {
        formContainer.classList.add('hidden');
    });

    // Submissão (Create / Update)
    mainForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgInfo = document.getElementById('recursoMsg');
        const btnSalvar = document.getElementById('btnSalvarRecurso');

        const id = document.getElementById('recursoId').value;
        const nome = document.getElementById('recursoNome').value;
        const ativo = document.getElementById('recursoAtivo').checked;
        const empresaId = window.dashboardContext.currentEmpresaId;
        const empTipo = window.dashboardContext.currentEmpresaTipo;

        msgInfo.style.display = 'none';
        btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnSalvar.disabled = true;

        const payload = {
            nome: nome,
            empresa_id: empresaId,
            ativo: ativo
        };

        if (empTipo === 'hotel') {
            payload.min_nights = parseInt(document.getElementById('recursoMinNights').value) || 1;
        } else {
            payload.min_nights = null;
        }

        let reqError;

        if (id) {
            const { error } = await window.supabase.from('recursos').update(payload).eq('id', id);
            reqError = error;
        } else {
            const { error } = await window.supabase.from('recursos').insert([payload]);
            reqError = error;
        }

        btnSalvar.innerHTML = 'Salvar';
        btnSalvar.disabled = false;

        if (reqError) {
            msgInfo.textContent = "Erro: " + reqError.message;
            msgInfo.style.display = 'block';
        } else {
            setTimeout(() => document.querySelector('[data-view="recursos"]').click(), 0); // Recarregar
        }
    });

    // Editar e Apagar
    document.querySelectorAll('.btn-edit-recurso').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.currentTarget;
            document.getElementById('recursoId').value = btnEl.getAttribute('data-id');
            document.getElementById('recursoNome').value = btnEl.getAttribute('data-nome');
            document.getElementById('recursoAtivo').checked = btnEl.getAttribute('data-ativo') === 'true';

            if (document.getElementById('recursoMinNights')) {
                document.getElementById('recursoMinNights').value = btnEl.getAttribute('data-min-nights') || '1';
            }

            title.textContent = 'Editar Recurso';
            formContainer.classList.remove('hidden');
            formContainer.scrollIntoView({ behavior: 'smooth' });
        });
    });

    document.querySelectorAll('.btn-delete-recurso').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const confirmado = await window.showConfirmModal('Apagar Recurso', 'Tem a certeza que deseja eliminar este recurso e TODOS os bloqueios, preços e reservas associadas?');
            if (confirmado) {
                const { error } = await window.supabase.from('recursos').delete().eq('id', id);
                if (error) {
                    window.showAlertModal('Erro', 'Erro a eliminar: ' + error.message);
                } else {
                    setTimeout(() => document.querySelector('[data-view="recursos"]').click(), 0);
                }
            }
        });
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
