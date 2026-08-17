export async function renderEmpresas(container, session) {
    const { data: empresas, error } = await window.supabase
        .from('empresas')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        container.innerHTML = `<div class="glass-panel" style="padding: 2rem; border-color: var(--danger);"><h3 style="color: var(--danger);">Erro a carregar empresas</h3><p>${error.message}</p></div>`;
        return;
    }

    // Identificar se o utilizador atual é o "Super Admin" (podemos cruzar com o email)
    const isAdmin = session.user.email === 'dsilva260405@gmail.com';

    let html = `
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div>
                    <h3>As Suas Empresas</h3>
                    <p class="text-sub" style="font-size: 0.85rem;">Gira os negócios associados à sua conta.</p>
                </div>
                <button class="btn btn-primary" id="btnNovaEmpresa" style="padding: 0.5rem 1rem; font-size: 0.85rem;"><i class="fa-solid fa-plus"></i> Nova Empresa</button>
            </div>

            <!-- Formulário Novo/Editar Empresa (Escondido por defeito) -->
            <div id="formContainerEmpresa" class="hidden" style="margin-bottom: 2rem; padding: 1.5rem; border: 1px solid var(--border-color); border-radius: 8px; background: rgba(0,0,0,0.2);">
                <h4 id="formEmpresaTitle" style="margin-bottom: 1rem;">Adicionar nova empresa</h4>
                <form id="formEmpresa">
                    <input type="hidden" id="empresaId" value="">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div class="form-group">
                            <label>Nome da Empresa</label>
                            <input type="text" id="empresaNome" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>Tipo</label>
                            <input type="text" id="empresaTipo" class="form-control" placeholder="ex: Turismo, Tattoo...">
                        </div>
                    </div>
                    ${isAdmin ? `
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label>Atribuir a Dono (ID do Auth User)</label>
                            <input type="text" id="empresaDonoId" class="form-control" value="">
                        </div>
                    ` : `<input type="hidden" id="empresaDonoId" value="${session.user.id}">`}
                    <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" id="btnCancelarEmpresa">Cancelar</button>
                        <button type="submit" class="btn btn-primary" id="btnSalvarEmpresa">Salvar</button>
                    </div>
                    <p id="empresaMsg" class="error-msg" style="margin-top: 1rem;"></p>
                </form>
            </div>

            <div class="data-table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Tipo</th>
                            ${isAdmin ? '<th>Dono ID</th>' : ''}
                            <th style="text-align: right;">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (empresas && empresas.length > 0) {
        empresas.forEach(emp => {
            html += `
                <tr>
                    <td><strong>${escapeHTML(emp.nome)}</strong></td>
                    <td>${emp.tipo ? `<span class="badge badge-primary">${escapeHTML(emp.tipo)}</span>` : '<span style="color: gray; font-size: 0.8rem;">Não definido</span>'}</td>
                    ${isAdmin ? `<td style="font-size: 0.75rem; color: gray;">${emp.dono_id}</td>` : ''}
                    <td>
                        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                            <button class="btn btn-secondary btn-edit-empresa" data-id="${emp.id}" data-nome="${escapeHTML(emp.nome)}" data-tipo="${escapeHTML(emp.tipo || '')}" data-dono="${emp.dono_id}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto;"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-secondary btn-delete-empresa" data-id="${emp.id}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto; color: var(--danger);"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } else {
        html += `<tr><td colspan="${isAdmin ? '4' : '3'}">Nenhuma empresa registada.</td></tr>`;
    }

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;

    // Listeners do Formulário
    setupEmpresasListeners(session, isAdmin);
}

function setupEmpresasListeners(session, isAdmin) {
    const btnNova = document.getElementById('btnNovaEmpresa');
    const formContainer = document.getElementById('formContainerEmpresa');
    const btnCancelar = document.getElementById('btnCancelarEmpresa');
    const form = document.getElementById('formEmpresa');
    const title = document.getElementById('formEmpresaTitle');

    // Toggle Formulário
    btnNova.addEventListener('click', () => {
        form.reset();
        document.getElementById('empresaId').value = '';
        if (isAdmin) document.getElementById('empresaDonoId').value = '';
        document.getElementById('empresaMsg').style.display = 'none';
        title.textContent = 'Adicionar nova empresa';
        formContainer.classList.toggle('hidden');
    });

    btnCancelar.addEventListener('click', () => {
        formContainer.classList.add('hidden');
    });

    // Submissão (Create / Update)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgInfo = document.getElementById('empresaMsg');
        const btnSalvar = document.getElementById('btnSalvarEmpresa');

        const id = document.getElementById('empresaId').value;
        const nome = document.getElementById('empresaNome').value;
        const tipo = document.getElementById('empresaTipo').value;
        const donoId = document.getElementById('empresaDonoId').value;

        msgInfo.style.display = 'none';
        btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnSalvar.disabled = true;

        const payload = {
            nome: nome,
            tipo: tipo || null,
            dono_id: donoId
        };

        let reqError;

        if (id) {
            // Update
            const { error } = await window.supabase.from('empresas').update(payload).eq('id', id);
            reqError = error;
        } else {
            // Insert
            const { error } = await window.supabase.from('empresas').insert([payload]);
            reqError = error;
        }

        btnSalvar.innerHTML = 'Salvar';
        btnSalvar.disabled = false;

        if (reqError) {
            msgInfo.textContent = "Erro: " + reqError.message;
            msgInfo.style.display = 'block';
        } else {
            // Atualizar o seletor do topbar e carregar vista
            if (window.refreshGlobalContext) {
                await window.refreshGlobalContext(session);
            }
            setTimeout(() => document.querySelector('[data-view="empresas"]').click(), 0);
        }
    });

    // Editar e Apagar
    document.querySelectorAll('.btn-edit-empresa').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.currentTarget;
            document.getElementById('empresaId').value = btnEl.getAttribute('data-id');
            document.getElementById('empresaNome').value = btnEl.getAttribute('data-nome');
            document.getElementById('empresaTipo').value = btnEl.getAttribute('data-tipo');
            if (isAdmin) document.getElementById('empresaDonoId').value = btnEl.getAttribute('data-dono');

            title.textContent = 'Editar Empresa';
            formContainer.classList.remove('hidden');
            formContainer.scrollIntoView({ behavior: 'smooth' });
        });
    });

    document.querySelectorAll('.btn-delete-empresa').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm('Tem a certeza que deseja eliminar esta empresa e TODOS os recursos e reservas associadas?')) {
                const { error } = await window.supabase.from('empresas').delete().eq('id', id);
                if (error) {
                    alert('Erro a eliminar: ' + error.message);
                } else {
                    if (window.refreshGlobalContext) {
                        await window.refreshGlobalContext(session);
                    }
                    setTimeout(() => document.querySelector('[data-view="empresas"]').click(), 0);
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
