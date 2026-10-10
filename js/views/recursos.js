import { getExportIcalUrl, syncRecursoBooking } from '../services/ical-service.js';

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
        .order('nome', { ascending: true });

    if (error) {
        container.innerHTML = `<div class="glass-panel" style="padding: 2rem; color: var(--danger);">Erro a carregar recursos: ${error.message}</div>`;
        return;
    }

    let html = `
        <div class="glass-panel" style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
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
                    <input type="hidden" id="recursoExportToken" value="">
                    
                    <div style="display: flex; gap: 1rem; align-items: stretch; margin-bottom: 1.5rem; flex-wrap: wrap;">
                        <div class="form-group" style="flex: 1; min-width: 250px; margin: 0; display: flex; flex-direction: column;">
                            <label>Nome do Recurso</label>
                            <input type="text" id="recursoNome" class="form-control" required placeholder="Nome do recurso..." style="flex: 1; box-sizing: border-box;">
                        </div>

                        <div class="form-group" style="flex: 1; min-width: 200px; margin: 0; display: flex; flex-direction: column;">
                            <label>Máx. Pessoas <small class="text-sub">(Opcional)</small></label>
                            <input type="number" id="recursoMaxPessoas" class="form-control" min="1" step="1" placeholder="Ex: 4" style="flex: 1; box-sizing: border-box;">
                        </div>

                        <div class="form-group" style="flex: 1; min-width: 200px; margin: 0; display: flex; flex-direction: column;">
                            <label>Texto Pessoas <small class="text-sub">(Opcional)</small></label>
                            <input type="text" id="recursoLabelPessoas" class="form-control" placeholder="Ex: Nº Adultos" style="flex: 1; box-sizing: border-box;">
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

                    <!-- SECÇÃO DE SINCRONIZAÇÃO BOOKING (ICAL) -->
                    <div style="border-top: 1px solid var(--border-color); padding-top: 1.25rem; margin-top: 1.25rem; margin-bottom: 1.5rem;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
                            <h5 style="margin: 0; font-size: 0.95rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                                <i class="fa-solid fa-hotel" style="color: #60a5fa;"></i> Sincronização Booking.com
                            </h5>
                            
                            <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                                <span id="syncStatusInfo" class="text-sub" style="font-size: 0.8rem; display: none;">
                                    <i class="fa-regular fa-clock"></i> Última sincronização: <strong id="syncLastTime" style="color: var(--text-main); font-weight: 500;">-</strong>
                                </span>
                                <button type="button" id="btnSyncNowForm" class="btn btn-secondary" style="font-size: 0.85rem; padding: 0.5rem 1rem; display: none;">
                                    <i class="fa-solid fa-arrows-rotate"></i> Sincronizar Agora
                                </button>
                            </div>
                        </div>

                        <div style="display: flex; gap: 1rem; align-items: stretch; flex-wrap: wrap;">
                            <!-- Link do Booking para Importar -->
                            <div class="form-group" style="flex: 1; min-width: 250px; margin: 0; display: flex; flex-direction: column;">
                                <label>Link Booking (Importar)</label>
                                <input type="url" id="recursoIcalImportUrl" class="form-control" placeholder="https://ical.booking.com/v1/export?t=..." style="flex: 1; box-sizing: border-box;">
                            </div>

                            <!-- Link deste Recurso para o Booking Exportar -->
                            <div class="form-group" id="groupExportIcal" style="flex: 1; min-width: 250px; margin: 0; display: none; flex-direction: column;">
                                <label>Link para o Booking (Exportar)</label>
                                <div style="display: flex; gap: 0.5rem; flex: 1;">
                                    <input type="text" id="recursoIcalExportUrl" class="form-control" readonly placeholder="Link para colar no Booking..." style="flex: 1; box-sizing: border-box; cursor: text;">
                                    <button type="button" id="btnCopyExportUrl" class="btn btn-secondary" style="padding: 0 1rem; font-size: 0.85rem; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.4rem;" title="Copiar link">
                                        <i class="fa-solid fa-copy"></i> Copiar
                                    </button>
                                </div>
                            </div>
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
                            <th>Máx. Pessoas</th>
                            ${empTipo === 'hotel' ? '<th>Mín. Noites</th>' : ''}
                            <th>Booking / iCal</th>
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
            const temIcal = !!rec.ical_import_url;

            const icalBadge = temIcal
                ? `<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);" title="Sincronização iCal Ativa"><i class="fa-solid fa-hotel"></i> Conectado</span>`
                : `<span class="text-sub" style="font-size: 0.8rem;">-</span>`;

            html += `
                <tr>
                    <td><strong>${escapeHTML(rec.nome)}</strong></td>
                    <td>${escapeHTML(empName)}</td>
                    <td>${rec.max_pessoas || '<span class="text-sub">Sem Limite</span>'}</td>
                    ${empTipo === 'hotel' ? `<td>${rec.min_nights || 1}</td>` : ''}
                    <td>${icalBadge}</td>
                    <td><span class="badge ${badgeClass}">${statusTxt}</span></td>
                    <td style="text-align: right;">
                        ${temIcal ? `
                        <button class="btn btn-secondary btn-quick-sync-ical" data-id="${rec.id}" data-nome="${escapeHTML(rec.nome)}" title="Sincronizar com Booking agora" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto; color: #60a5fa; border-color: rgba(96,165,250,0.3);">
                            <i class="fa-solid fa-arrows-rotate"></i>
                        </button>
                        ` : ''}
                        <button class="btn btn-secondary btn-edit-recurso" 
                            data-id="${rec.id}" 
                            data-nome="${escapeHTML(rec.nome)}" 
                            data-max-pessoas="${rec.max_pessoas || ''}" 
                            data-label-pessoas="${escapeHTML(rec.label_pessoas || '')}" 
                            data-min-nights="${rec.min_nights || 1}" 
                            data-empresa="${rec.empresa_id}" 
                            data-ativo="${rec.ativo}"
                            data-ical-import="${escapeHTML(rec.ical_import_url || '')}"
                            data-ical-token="${escapeHTML(rec.ical_export_token || '')}"
                            data-ical-sync="${escapeHTML(rec.ical_last_sync || '')}"
                            style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto;" title="Editar"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn btn-secondary btn-delete-recurso" data-id="${rec.id}" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto; color: var(--danger);" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    } else {
        html += `<tr><td colspan="${empTipo === 'hotel' ? 7 : 6}">Nenhum recurso encontrado. Crie um recurso para a sua empresa.</td></tr>`;
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
    const groupExport = document.getElementById('groupExportIcal');
    const btnSyncForm = document.getElementById('btnSyncNowForm');
    const syncStatusInfo = document.getElementById('syncStatusInfo');
    const syncLastTime = document.getElementById('syncLastTime');
    const copyExportBtn = document.getElementById('btnCopyExportUrl');

    // Toggle Formulário Novo
    btnNovo.addEventListener('click', () => {
        mainForm.reset();
        document.getElementById('recursoId').value = '';
        document.getElementById('recursoExportToken').value = '';
        document.getElementById('recursoAtivo').checked = true;
        document.getElementById('recursoMaxPessoas').value = '';
        document.getElementById('recursoLabelPessoas').value = '';
        document.getElementById('recursoIcalImportUrl').value = '';
        document.getElementById('recursoIcalExportUrl').value = '';
        if (document.getElementById('recursoMinNights')) {
            document.getElementById('recursoMinNights').value = '1';
        }
        if (groupExport) groupExport.style.display = 'none';
        if (btnSyncForm) btnSyncForm.style.display = 'none';
        if (syncStatusInfo) syncStatusInfo.style.display = 'none';

        document.getElementById('recursoMsg').style.display = 'none';
        title.textContent = 'Adicionar novo recurso';
        formContainer.classList.toggle('hidden');
    });

    btnCancelar.addEventListener('click', () => {
        formContainer.classList.add('hidden');
    });

    // Copiar URL de Exportação
    if (copyExportBtn) {
        copyExportBtn.addEventListener('click', () => {
            const input = document.getElementById('recursoIcalExportUrl');
            if (input && input.value) {
                navigator.clipboard.writeText(input.value).then(() => {
                    copyExportBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
                    setTimeout(() => {
                        copyExportBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copiar';
                    }, 2000);
                });
            }
        });
    }

    // Sincronizar Agora no formulário
    if (btnSyncForm) {
        btnSyncForm.addEventListener('click', async () => {
            const recursoId = document.getElementById('recursoId').value;
            if (!recursoId) return;

            const originalHtml = btnSyncForm.innerHTML;
            btnSyncForm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A sincronizar...';
            btnSyncForm.disabled = true;

            try {
                const res = await syncRecursoBooking(recursoId);
                const count = res.eventsCount !== undefined ? res.eventsCount : (res.report?.[0]?.eventsFound || 0);
                window.showAlertModal('Sincronização Concluída', `O calendário foi sincronizado com sucesso! Encontrados ${count} períodos no Booking.`);
                setTimeout(() => document.querySelector('[data-view="recursos"]').click(), 1200);
            } catch (err) {
                window.showAlertModal('Erro na Sincronização', err.message);
            } finally {
                btnSyncForm.innerHTML = originalHtml;
                btnSyncForm.disabled = false;
            }
        });
    }

    // Sincronização rápida direta na tabela
    document.querySelectorAll('.btn-quick-sync-ical').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            const nome = btn.getAttribute('data-nome');
            const icon = btn.querySelector('i');

            icon.className = 'fa-solid fa-spinner fa-spin';
            btn.disabled = true;

            try {
                const res = await syncRecursoBooking(id);
                const count = res.eventsCount !== undefined ? res.eventsCount : (res.report?.[0]?.eventsFound || 0);
                window.showAlertModal('Sincronização com o Booking', `Recurso "${nome}" sincronizado com sucesso! ${count} datas verificadas.`);
                setTimeout(() => document.querySelector('[data-view="recursos"]').click(), 1200);
            } catch (err) {
                window.showAlertModal('Erro na Sincronização', err.message);
            } finally {
                icon.className = 'fa-solid fa-arrows-rotate';
                btn.disabled = false;
            }
        });
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
        const icalImportUrl = document.getElementById('recursoIcalImportUrl').value.trim() || null;

        msgInfo.style.display = 'none';
        btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnSalvar.disabled = true;

        const payload = {
            nome: nome,
            empresa_id: empresaId,
            ativo: ativo,
            max_pessoas: document.getElementById('recursoMaxPessoas').value ? parseInt(document.getElementById('recursoMaxPessoas').value) : null,
            label_pessoas: document.getElementById('recursoLabelPessoas').value || null,
            ical_import_url: icalImportUrl
        };

        if (empTipo === 'hotel') {
            payload.min_nights = parseInt(document.getElementById('recursoMinNights').value) || 1;
        } else {
            payload.min_nights = null;
        }

        let reqError;
        let createdId = id;

        if (id) {
            const { error } = await window.supabase.from('recursos').update(payload).eq('id', id);
            reqError = error;
        } else {
            const { data, error } = await window.supabase.from('recursos').insert([payload]).select('id').single();
            reqError = error;
            if (data) createdId = data.id;
        }

        btnSalvar.innerHTML = 'Salvar';
        btnSalvar.disabled = false;

        if (reqError) {
            msgInfo.textContent = "Erro: " + reqError.message;
            msgInfo.style.display = 'block';
        } else {
            // Se foi fornecido um URL de iCal, dispara sincronização de boas-vindas imediatamente
            if (icalImportUrl && createdId) {
                syncRecursoBooking(createdId).catch(console.warn);
            }
            setTimeout(() => document.querySelector('[data-view="recursos"]').click(), 0); // Recarregar
        }
    });

    // Editar e Apagar
    document.querySelectorAll('.btn-edit-recurso').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.currentTarget;
            const recId = btnEl.getAttribute('data-id');
            const icalImport = btnEl.getAttribute('data-ical-import') || '';
            const icalToken = btnEl.getAttribute('data-ical-token') || '';
            const icalSync = btnEl.getAttribute('data-ical-sync') || '';

            document.getElementById('recursoId').value = recId;
            document.getElementById('recursoNome').value = btnEl.getAttribute('data-nome');
            document.getElementById('recursoMaxPessoas').value = btnEl.getAttribute('data-max-pessoas') || '';
            document.getElementById('recursoLabelPessoas').value = btnEl.getAttribute('data-label-pessoas') || '';
            document.getElementById('recursoAtivo').checked = btnEl.getAttribute('data-ativo') === 'true';

            if (document.getElementById('recursoMinNights')) {
                document.getElementById('recursoMinNights').value = btnEl.getAttribute('data-min-nights') || '1';
            }

            // Preencher campos iCal
            document.getElementById('recursoIcalImportUrl').value = icalImport;
            document.getElementById('recursoExportToken').value = icalToken;

            if (groupExport && icalToken) {
                groupExport.style.display = 'flex';
                document.getElementById('recursoIcalExportUrl').value = getExportIcalUrl(icalToken);
            } else if (groupExport) {
                groupExport.style.display = 'none';
            }

            if (btnSyncForm) {
                btnSyncForm.style.display = icalImport ? 'inline-flex' : 'none';
            }

            if (syncStatusInfo) {
                if (icalSync) {
                    syncStatusInfo.style.display = 'inline-flex';
                    const d = new Date(icalSync);
                    syncLastTime.textContent = d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                } else {
                    syncStatusInfo.style.display = 'none';
                }
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
