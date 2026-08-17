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
                    
                    <div style="margin-bottom: 1rem;">
                        <div class="form-group">
                            <label>Recurso a Bloquear</label>
                            <select id="bloqueioRecursoId" class="form-control" required>
                                <option value="" disabled selected>Escolha o recurso...</option>
                                ${meusRecursos && meusRecursos.length > 0
            ? meusRecursos.map(r => `<option value="${r.id}">${escapeHTML(r.nome)}</option>`).join('')
            : `<option value="" disabled>Nenhum recurso encontrado na empresa.</option>`}
                            </select>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div class="form-group">
                            <label>Início (Data e Hora)</label>
                            <input type="datetime-local" id="bloqueioDataInicio" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>Fim (Data e Hora)</label>
                            <input type="datetime-local" id="bloqueioDataFim" class="form-control" required>
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

            // O datetime-local HTML necessita de formato YYYY-MM-DDTHH:MM
            // Vamos formatar logo usando JS vanilla
            const inicioISO = new Date(bloq.data_hora_inicio);
            const fimISO = new Date(bloq.data_hora_fim);

            // Corrige offset para datetime-local
            const formatForInput = (d) => new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

            html += `
                <tr>
                    <td><strong>${escapeHTML(recursoNome)}</strong></td>
                    <td style="color: var(--danger);">${formataDataHora(bloq.data_hora_inicio)}</td>
                    <td style="color: var(--danger);">${formataDataHora(bloq.data_hora_fim)}</td>
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

    const btnNovo = document.getElementById('btnNovoBloqueio');
    const formContainer = document.getElementById('formContainerBloqueio');
    const btnCancelar = document.getElementById('btnCancelarBloqueio');
    const title = document.getElementById('formBloqueioTitle');
    const selectRecurso = document.getElementById('bloqueioRecursoId');

    btnNovo.addEventListener('click', () => {
        mainForm.reset();
        document.getElementById('bloqueioId').value = '';
        document.getElementById('bloqueioMsg').style.display = 'none';
        title.textContent = 'Inserir Bloqueio';
        formContainer.classList.toggle('hidden');
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
        const dataInicio = new Date(document.getElementById('bloqueioDataInicio').value).toISOString();
        const dataFim = new Date(document.getElementById('bloqueioDataFim').value).toISOString();

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
            document.getElementById('bloqueioRecursoId').value = btnEl.getAttribute('data-recurso');

            document.getElementById('bloqueioDataInicio').value = btnEl.getAttribute('data-inicio');
            document.getElementById('bloqueioDataFim').value = btnEl.getAttribute('data-fim');

            title.textContent = 'Editar Bloqueio de Calendário';
            formContainer.classList.remove('hidden');
            formContainer.scrollIntoView({ behavior: 'smooth' });
        });
    });

    document.querySelectorAll('.btn-delete-bloqueio').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm('Remover este bloqueio e repôr disponibilidade?')) {
                const { error } = await window.supabase.from('bloqueios_disponibilidade').delete().eq('id', id);
                if (error) {
                    alert('Erro a eliminar: ' + error.message);
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
