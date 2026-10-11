import { getExportIcalUrl, syncRecursoBooking, syncRecursoAirbnb } from '../services/ical-service.js';

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

                    <!-- SECÇÃO DE SINCRONIZAÇÃO DE CANAIS (BOOKING & AIRBNB) -->
                    <div style="border-top: 1px solid var(--border-color); padding-top: 1.25rem; margin-top: 1.25rem; margin-bottom: 1.5rem;">
                        <h4 style="margin-bottom: 0.5rem; font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fa-solid fa-arrows-rotate" style="color: var(--primary-color);"></i> Sincronização de Canais (iCal)
                        </h4>
                        <p class="text-sub" style="font-size: 0.85rem; margin-bottom: 1.25rem;">
                            Sincronize as reservas com Booking.com e Airbnb em tempo real para prevenir conflitos e overbooking.
                        </p>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;">
                            <!-- CARD BOOKING.COM -->
                            <div style="background: rgba(37, 99, 235, 0.05); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 8px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;">
                                <div>
                                    <div style="margin-bottom: 1rem;">
                                        <h5 style="margin: 0 0 0.5rem 0; font-size: 0.95rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; color: #60a5fa;">
                                            <i class="fa-solid fa-hotel"></i> Booking.com
                                        </h5>
                                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; min-height: 28px;">
                                            <span id="syncStatusInfoBooking" class="text-sub" style="font-size: 0.75rem; display: none; align-items: center; gap: 0.35rem;">
                                                <i class="fa-regular fa-clock"></i> <strong id="syncLastTimeBooking" style="color: var(--text-main);">-</strong>
                                            </span>
                                            <button type="button" id="btnSyncNowBookingForm" class="btn btn-secondary" style="font-size: 0.78rem; padding: 0.3rem 0.65rem; display: none; color: #60a5fa; border-color: rgba(96,165,250,0.3); margin-left: auto;">
                                                <i class="fa-solid fa-arrows-rotate"></i> Sincronizar
                                            </button>
                                        </div>
                                    </div>

                                    <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                                        <div class="form-group" style="margin: 0;">
                                            <label style="font-size: 0.8rem;">Link Booking (Importar)</label>
                                            <input type="url" id="recursoIcalImportUrl" class="form-control" placeholder="https://ical.booking.com/v1/export?t=..." style="box-sizing: border-box; font-size: 0.85rem;">
                                        </div>

                                        <div class="form-group" id="groupExportBooking" style="margin: 0; display: none;">
                                            <label style="font-size: 0.8rem;">Link para o Booking (Exportar)</label>
                                            <div style="display: flex; gap: 0.4rem;">
                                                <input type="text" id="recursoIcalExportUrlBooking" class="form-control" readonly placeholder="Link para colar no Booking..." style="box-sizing: border-box; cursor: text; font-size: 0.8rem;">
                                                <button type="button" id="btnCopyExportUrlBooking" class="btn btn-secondary" style="padding: 0 0.75rem; font-size: 0.8rem; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.3rem;" title="Copiar link Booking">
                                                    <i class="fa-solid fa-copy"></i> Copiar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- CARD AIRBNB -->
                            <div style="background: rgba(255, 56, 92, 0.05); border: 1px solid rgba(255, 56, 92, 0.25); border-radius: 8px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;">
                                <div>
                                    <div style="margin-bottom: 1rem;">
                                        <h5 style="margin: 0 0 0.5rem 0; font-size: 0.95rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; color: #ff385c;">
                                            <i class="fa-brands fa-airbnb"></i> Airbnb
                                        </h5>
                                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; min-height: 28px;">
                                            <span id="syncStatusInfoAirbnb" class="text-sub" style="font-size: 0.75rem; display: none; align-items: center; gap: 0.35rem;">
                                                <i class="fa-regular fa-clock"></i> <strong id="syncLastTimeAirbnb" style="color: var(--text-main);">-</strong>
                                            </span>
                                            <button type="button" id="btnSyncNowAirbnbForm" class="btn btn-secondary" style="font-size: 0.78rem; padding: 0.3rem 0.65rem; display: none; color: #ff385c; border-color: rgba(255,56,92,0.3); margin-left: auto;">
                                                <i class="fa-solid fa-arrows-rotate"></i> Sincronizar
                                            </button>
                                        </div>
                                    </div>

                                    <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                                        <div class="form-group" style="margin: 0;">
                                            <label style="font-size: 0.8rem;">Link Airbnb (Importar)</label>
                                            <input type="url" id="recursoIcalAirbnbUrl" class="form-control" placeholder="https://www.airbnb.pt/calendar/ical/...ics?t=..." style="box-sizing: border-box; font-size: 0.85rem;">
                                        </div>

                                        <div class="form-group" id="groupExportAirbnb" style="margin: 0; display: none;">
                                            <label style="font-size: 0.8rem;">Link para o Airbnb (Exportar)</label>
                                            <div style="display: flex; gap: 0.4rem;">
                                                <input type="text" id="recursoIcalExportUrlAirbnb" class="form-control" readonly placeholder="Link para colar no Airbnb..." style="box-sizing: border-box; cursor: text; font-size: 0.8rem;">
                                                <button type="button" id="btnCopyExportUrlAirbnb" class="btn btn-secondary" style="padding: 0 0.75rem; font-size: 0.8rem; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.3rem;" title="Copiar link Airbnb">
                                                    <i class="fa-solid fa-copy"></i> Copiar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
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
                            <th>Canais (iCal)</th>
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
            const temBooking = !!rec.ical_import_url;
            const temAirbnb = !!rec.ical_airbnb_url;

            const badgesList = [];
            if (temBooking) {
                badgesList.push(`<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);" title="Booking Conectado"><i class="fa-solid fa-hotel"></i> Booking</span>`);
            }
            if (temAirbnb) {
                badgesList.push(`<span class="badge" style="background: rgba(255, 56, 92, 0.15); color: #ff385c; border: 1px solid rgba(255, 56, 92, 0.3);" title="Airbnb Conectado"><i class="fa-brands fa-airbnb"></i> Airbnb</span>`);
            }

            const canaisBadge = badgesList.length > 0
                ? `<div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">${badgesList.join('')}</div>`
                : `<span class="text-sub" style="font-size: 0.8rem;">-</span>`;

            html += `
                <tr>
                    <td><strong>${escapeHTML(rec.nome)}</strong></td>
                    <td>${escapeHTML(empName)}</td>
                    <td>${rec.max_pessoas || '<span class="text-sub">Sem Limite</span>'}</td>
                    ${empTipo === 'hotel' ? `<td>${rec.min_nights || 1}</td>` : ''}
                    <td>${canaisBadge}</td>
                    <td><span class="badge ${badgeClass}">${statusTxt}</span></td>
                    <td style="text-align: right;">
                        ${temBooking ? `
                        <button class="btn btn-secondary btn-quick-sync-booking" data-id="${rec.id}" data-nome="${escapeHTML(rec.nome)}" title="Sincronizar Booking agora" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto; color: #60a5fa; border-color: rgba(96,165,250,0.3);">
                            <i class="fa-solid fa-arrows-rotate"></i> <i class="fa-solid fa-hotel" style="font-size: 0.75rem;"></i>
                        </button>
                        ` : ''}
                        ${temAirbnb ? `
                        <button class="btn btn-secondary btn-quick-sync-airbnb" data-id="${rec.id}" data-nome="${escapeHTML(rec.nome)}" title="Sincronizar Airbnb agora" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; min-width: auto; color: #ff385c; border-color: rgba(255,56,92,0.3);">
                            <i class="fa-solid fa-arrows-rotate"></i> <i class="fa-brands fa-airbnb" style="font-size: 0.75rem;"></i>
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
                            data-ical-airbnb="${escapeHTML(rec.ical_airbnb_url || '')}"
                            data-ical-airbnb-sync="${escapeHTML(rec.ical_airbnb_last_sync || '')}"
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

    // Elementos Booking
    const groupExportBooking = document.getElementById('groupExportBooking');
    const btnSyncBookingForm = document.getElementById('btnSyncNowBookingForm');
    const syncStatusInfoBooking = document.getElementById('syncStatusInfoBooking');
    const syncLastTimeBooking = document.getElementById('syncLastTimeBooking');
    const copyExportBookingBtn = document.getElementById('btnCopyExportUrlBooking');

    // Elementos Airbnb
    const groupExportAirbnb = document.getElementById('groupExportAirbnb');
    const btnSyncAirbnbForm = document.getElementById('btnSyncNowAirbnbForm');
    const syncStatusInfoAirbnb = document.getElementById('syncStatusInfoAirbnb');
    const syncLastTimeAirbnb = document.getElementById('syncLastTimeAirbnb');
    const copyExportAirbnbBtn = document.getElementById('btnCopyExportUrlAirbnb');

    // Toggle Formulário Novo
    btnNovo.addEventListener('click', () => {
        mainForm.reset();
        document.getElementById('recursoId').value = '';
        document.getElementById('recursoExportToken').value = '';
        document.getElementById('recursoAtivo').checked = true;
        document.getElementById('recursoMaxPessoas').value = '';
        document.getElementById('recursoLabelPessoas').value = '';

        // Reset Booking
        document.getElementById('recursoIcalImportUrl').value = '';
        document.getElementById('recursoIcalExportUrlBooking').value = '';
        if (groupExportBooking) groupExportBooking.style.display = 'none';
        if (btnSyncBookingForm) btnSyncBookingForm.style.display = 'none';
        if (syncStatusInfoBooking) syncStatusInfoBooking.style.display = 'none';

        // Reset Airbnb
        document.getElementById('recursoIcalAirbnbUrl').value = '';
        document.getElementById('recursoIcalExportUrlAirbnb').value = '';
        if (groupExportAirbnb) groupExportAirbnb.style.display = 'none';
        if (btnSyncAirbnbForm) btnSyncAirbnbForm.style.display = 'none';
        if (syncStatusInfoAirbnb) syncStatusInfoAirbnb.style.display = 'none';

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

    // Copiar URL de Exportação para o Booking
    if (copyExportBookingBtn) {
        copyExportBookingBtn.addEventListener('click', () => {
            const input = document.getElementById('recursoIcalExportUrlBooking');
            if (input && input.value) {
                navigator.clipboard.writeText(input.value).then(() => {
                    copyExportBookingBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                    setTimeout(() => {
                        copyExportBookingBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copiar';
                    }, 2000);
                });
            }
        });
    }

    // Copiar URL de Exportação para o Airbnb
    if (copyExportAirbnbBtn) {
        copyExportAirbnbBtn.addEventListener('click', () => {
            const input = document.getElementById('recursoIcalExportUrlAirbnb');
            if (input && input.value) {
                navigator.clipboard.writeText(input.value).then(() => {
                    copyExportAirbnbBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
                    setTimeout(() => {
                        copyExportAirbnbBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copiar';
                    }, 2000);
                });
            }
        });
    }

    // Sincronizar Booking no formulário
    if (btnSyncBookingForm) {
        btnSyncBookingForm.addEventListener('click', async () => {
            const recursoId = document.getElementById('recursoId').value;
            if (!recursoId) return;

            const originalHtml = btnSyncBookingForm.innerHTML;
            btnSyncBookingForm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A sincronizar...';
            btnSyncBookingForm.disabled = true;

            try {
                const res = await syncRecursoBooking(recursoId);
                const count = res.eventsCount !== undefined ? res.eventsCount : (res.report?.[0]?.eventsFound || 0);
                window.showAlertModal('Sincronização Concluída', `O Booking.com foi sincronizado com sucesso! Encontrados ${count} períodos.`);
                setTimeout(() => document.querySelector('[data-view="recursos"]').click(), 1200);
            } catch (err) {
                window.showAlertModal('Erro na Sincronização do Booking', err.message);
            } finally {
                btnSyncBookingForm.innerHTML = originalHtml;
                btnSyncBookingForm.disabled = false;
            }
        });
    }

    // Sincronizar Airbnb no formulário
    if (btnSyncAirbnbForm) {
        btnSyncAirbnbForm.addEventListener('click', async () => {
            const recursoId = document.getElementById('recursoId').value;
            if (!recursoId) return;

            const originalHtml = btnSyncAirbnbForm.innerHTML;
            btnSyncAirbnbForm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A sincronizar...';
            btnSyncAirbnbForm.disabled = true;

            try {
                const res = await syncRecursoAirbnb(recursoId);
                const count = res.eventsCount !== undefined ? res.eventsCount : (res.report?.[0]?.eventsFound || 0);
                window.showAlertModal('Sincronização Concluída', `O Airbnb foi sincronizado com sucesso! Encontrados ${count} períodos.`);
                setTimeout(() => document.querySelector('[data-view="recursos"]').click(), 1200);
            } catch (err) {
                window.showAlertModal('Erro na Sincronização do Airbnb', err.message);
            } finally {
                btnSyncAirbnbForm.innerHTML = originalHtml;
                btnSyncAirbnbForm.disabled = false;
            }
        });
    }

    // Sincronização rápida Booking direta na tabela
    document.querySelectorAll('.btn-quick-sync-booking').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            const nome = btn.getAttribute('data-nome');
            const icon = btn.querySelector('.fa-arrows-rotate');

            if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
            btn.disabled = true;

            try {
                const res = await syncRecursoBooking(id);
                const count = res.eventsCount !== undefined ? res.eventsCount : (res.report?.[0]?.eventsFound || 0);
                window.showAlertModal('Sincronização Booking', `Recurso "${nome}" sincronizado com sucesso! ${count} datas verificadas.`);
                setTimeout(() => document.querySelector('[data-view="recursos"]').click(), 1200);
            } catch (err) {
                window.showAlertModal('Erro na Sincronização', err.message);
            } finally {
                if (icon) icon.className = 'fa-solid fa-arrows-rotate';
                btn.disabled = false;
            }
        });
    });

    // Sincronização rápida Airbnb direta na tabela
    document.querySelectorAll('.btn-quick-sync-airbnb').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-id');
            const nome = btn.getAttribute('data-nome');
            const icon = btn.querySelector('.fa-arrows-rotate');

            if (icon) icon.className = 'fa-solid fa-spinner fa-spin';
            btn.disabled = true;

            try {
                const res = await syncRecursoAirbnb(id);
                const count = res.eventsCount !== undefined ? res.eventsCount : (res.report?.[0]?.eventsFound || 0);
                window.showAlertModal('Sincronização Airbnb', `Recurso "${nome}" sincronizado com sucesso! ${count} datas verificadas no Airbnb.`);
                setTimeout(() => document.querySelector('[data-view="recursos"]').click(), 1200);
            } catch (err) {
                window.showAlertModal('Erro na Sincronização', err.message);
            } finally {
                if (icon) icon.className = 'fa-solid fa-arrows-rotate';
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
        const icalAirbnbUrl = document.getElementById('recursoIcalAirbnbUrl').value.trim() || null;

        msgInfo.style.display = 'none';
        btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnSalvar.disabled = true;

        const payload = {
            nome: nome,
            empresa_id: empresaId,
            ativo: ativo,
            max_pessoas: document.getElementById('recursoMaxPessoas').value ? parseInt(document.getElementById('recursoMaxPessoas').value) : null,
            label_pessoas: document.getElementById('recursoLabelPessoas').value || null,
            ical_import_url: icalImportUrl,
            ical_airbnb_url: icalAirbnbUrl
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
            // Se foi fornecido URL de Booking, dispara sincronização de boas-vindas
            if (icalImportUrl && createdId) {
                syncRecursoBooking(createdId).catch(console.warn);
            }
            // Se foi fornecido URL de Airbnb, dispara sincronização de boas-vindas
            if (icalAirbnbUrl && createdId) {
                syncRecursoAirbnb(createdId).catch(console.warn);
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
            const icalAirbnb = btnEl.getAttribute('data-ical-airbnb') || '';
            const icalAirbnbSync = btnEl.getAttribute('data-ical-airbnb-sync') || '';

            document.getElementById('recursoId').value = recId;
            document.getElementById('recursoNome').value = btnEl.getAttribute('data-nome');
            document.getElementById('recursoMaxPessoas').value = btnEl.getAttribute('data-max-pessoas') || '';
            document.getElementById('recursoLabelPessoas').value = btnEl.getAttribute('data-label-pessoas') || '';
            document.getElementById('recursoAtivo').checked = btnEl.getAttribute('data-ativo') === 'true';

            if (document.getElementById('recursoMinNights')) {
                document.getElementById('recursoMinNights').value = btnEl.getAttribute('data-min-nights') || '1';
            }

            document.getElementById('recursoExportToken').value = icalToken;

            // Preencher campos Booking
            document.getElementById('recursoIcalImportUrl').value = icalImport;
            if (groupExportBooking && icalToken) {
                groupExportBooking.style.display = 'block';
                document.getElementById('recursoIcalExportUrlBooking').value = getExportIcalUrl(icalToken);
            } else if (groupExportBooking) {
                groupExportBooking.style.display = 'none';
            }

            if (btnSyncBookingForm) {
                btnSyncBookingForm.style.display = icalImport ? 'inline-flex' : 'none';
            }

            if (syncStatusInfoBooking) {
                if (icalSync) {
                    syncStatusInfoBooking.style.display = 'inline-flex';
                    const d = new Date(icalSync);
                    syncLastTimeBooking.textContent = d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                } else {
                    syncStatusInfoBooking.style.display = 'none';
                }
            }

            // Preencher campos Airbnb
            document.getElementById('recursoIcalAirbnbUrl').value = icalAirbnb;
            if (groupExportAirbnb && icalToken) {
                groupExportAirbnb.style.display = 'block';
                document.getElementById('recursoIcalExportUrlAirbnb').value = getExportIcalUrl(icalToken);
            } else if (groupExportAirbnb) {
                groupExportAirbnb.style.display = 'none';
            }

            if (btnSyncAirbnbForm) {
                btnSyncAirbnbForm.style.display = icalAirbnb ? 'inline-flex' : 'none';
            }

            if (syncStatusInfoAirbnb) {
                if (icalAirbnbSync) {
                    syncStatusInfoAirbnb.style.display = 'inline-flex';
                    const d = new Date(icalAirbnbSync);
                    syncLastTimeAirbnb.textContent = d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                } else {
                    syncStatusInfoAirbnb.style.display = 'none';
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
