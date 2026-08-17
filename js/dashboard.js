import { renderEmpresas } from './views/empresas.js';
import { renderRecursos } from './views/recursos.js';
import { renderPrecos } from './views/precos.js';
import { renderBloqueios } from './views/bloqueios.js';
import { renderReservas } from './views/reservas.js';

window.dashboardContext = {
    isAdmin: false,
    empresas: [],
    currentEmpresaId: null,
    currentEmpresaName: null,
    currentEmpresaTipo: null
};

document.addEventListener('DOMContentLoaded', async () => {
    // Verifica Sessão imediatamente
    if (!window.supabase) {
        document.getElementById('contentArea').innerHTML = `
            <div class="glass-panel" style="padding: 2rem; border-color: var(--danger);">
                <h3 style="color: var(--danger);">Aviso Crítico</h3>
                <p>O Supabase não está configurado. Por favor, edite o ficheiro <code>js/supabase-config.js</code>.</p>
            </div>
        `;
        return;
    }

    const { data: { session }, error } = await window.supabase.auth.getSession();

    if (error || !session) {
        // Não está autenticado
        window.location.href = 'index.html';
        return;
    }

    // Identifica papel
    window.dashboardContext.isAdmin = session.user.email === 'dsilva260405@gmail.com';

    // Configurar o UI do user
    document.getElementById('userEmail').textContent = session.user.email;

    // Listeners do UI
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await window.supabase.auth.signOut();
        window.location.href = 'index.html';
    });

    window.refreshGlobalContext = async (session) => {
        const { data: userEmpresas } = await window.supabase.from('empresas').select('id, nome, tipo').order('id', { ascending: false });

        window.dashboardContext.empresas = userEmpresas || [];

        const contextWrapper = document.getElementById('companyContextWrapper');
        const navEmpresas = document.getElementById('navEmpresas');

        if (window.dashboardContext.isAdmin) {
            navEmpresas.classList.remove('hidden'); // Exibe tab de empresas

            if (window.dashboardContext.empresas.length > 0) {
                // Ensure current ID is still valid, else fallback to first
                let currExists = window.dashboardContext.empresas.find(x => x.id == window.dashboardContext.currentEmpresaId);
                if (!currExists) {
                    window.dashboardContext.currentEmpresaId = window.dashboardContext.empresas[0].id;
                    window.dashboardContext.currentEmpresaName = window.dashboardContext.empresas[0].nome;
                    window.dashboardContext.currentEmpresaTipo = window.dashboardContext.empresas[0].tipo;
                } else {
                    window.dashboardContext.currentEmpresaTipo = currExists.tipo;
                }

                let selectHTML = `<select id="globalEmpresaSelect" class="form-control" style="padding: 0.4rem 1rem; border-radius: 99px; background: rgba(0,0,0,0.4); font-size: 0.85rem; max-width: 200px;">`;
                window.dashboardContext.empresas.forEach(emp => {
                    let selected = emp.id == window.dashboardContext.currentEmpresaId ? 'selected' : '';
                    selectHTML += `<option value="${emp.id}" ${selected}>${emp.nome}</option>`;
                });
                selectHTML += `</select>`;

                contextWrapper.innerHTML = selectHTML;
                contextWrapper.classList.remove('hidden');

                document.getElementById('globalEmpresaSelect').addEventListener('change', (e) => {
                    window.dashboardContext.currentEmpresaId = e.target.value;
                    const emp = window.dashboardContext.empresas.find(x => x.id == e.target.value);
                    window.dashboardContext.currentEmpresaName = emp ? emp.nome : null;
                    window.dashboardContext.currentEmpresaTipo = emp ? emp.tipo : null;

                    updateUIBasedOnTipo();

                    // Recarregar a view actual
                    const activeNav = document.querySelector('#navLinks li.active');
                    if (activeNav) {
                        loadView(activeNav.getAttribute('data-view'), session);
                    }
                });
            } else {
                contextWrapper.innerHTML = '';
                contextWrapper.classList.add('hidden');
                window.dashboardContext.currentEmpresaId = null;
                window.dashboardContext.currentEmpresaName = null;
                window.dashboardContext.currentEmpresaTipo = null;
            }
        } else {
            // Owner Normal
            navEmpresas.classList.add('hidden'); // Ocultar tab

            if (window.dashboardContext.empresas.length > 0) {
                window.dashboardContext.currentEmpresaId = window.dashboardContext.empresas[0].id;
                window.dashboardContext.currentEmpresaName = window.dashboardContext.empresas[0].nome;
                window.dashboardContext.currentEmpresaTipo = window.dashboardContext.empresas[0].tipo;

                contextWrapper.innerHTML = `<span class="badge badge-success" style="font-size: 0.85rem;"><i class="fa-solid fa-building"></i> ${escapeHTML(window.dashboardContext.currentEmpresaName)}</span>`;
                contextWrapper.classList.remove('hidden');
            } else {
                contextWrapper.innerHTML = '';
                contextWrapper.classList.add('hidden');
                window.dashboardContext.currentEmpresaId = null;
                window.dashboardContext.currentEmpresaName = null;
                window.dashboardContext.currentEmpresaTipo = null;
            }
        }

        updateUIBasedOnTipo();
    };

    function updateUIBasedOnTipo() {
        const tipo = window.dashboardContext.currentEmpresaTipo ? window.dashboardContext.currentEmpresaTipo.toLowerCase() : '';
        const navPrecos = document.querySelector('li[data-view="precos"]');
        if (navPrecos) {
            if (tipo === 'hotel') {
                navPrecos.classList.remove('hidden-by-type');
                navPrecos.style.display = 'flex';
            } else {
                navPrecos.classList.add('hidden-by-type');
                navPrecos.style.display = 'none';

                // Redirect if currently on precos
                const activeNav = document.querySelector('#navLinks li.active');
                if (activeNav && activeNav.getAttribute('data-view') === 'precos') {
                    document.querySelector('#navLinks li[data-view="recursos"]').click();
                }
            }
        }
    }

    // Load context for the first time
    await window.refreshGlobalContext(session);

    const navLinks = document.querySelectorAll('#navLinks li');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            document.querySelectorAll('#navLinks li').forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');

            const view = e.currentTarget.getAttribute('data-view');
            loadView(view, session);
        });
    });

    // Carrega view inicial (empresas se admin, recursos se owner normal)
    const activeRoute = window.dashboardContext.isAdmin ? 'empresas' : 'recursos';
    document.querySelectorAll('#navLinks li').forEach(l => l.classList.remove('active'));
    document.querySelector(`#navLinks li[data-view="${activeRoute}"]`).classList.add('active');
    loadView(activeRoute, session);
});

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

// Função de carregamento das Vistas modularizada
async function loadView(view, session) {
    const contentArea = document.getElementById('contentArea');

    contentArea.innerHTML = '<div class="glass-panel" style="padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</div>';

    switch (view) {
        case 'empresas':
            await renderEmpresas(contentArea, session);
            break;
        case 'recursos':
            await renderRecursos(contentArea, session);
            break;
        case 'precos':
            await renderPrecos(contentArea, session);
            break;
        case 'bloqueios':
            await renderBloqueios(contentArea, session);
            break;
        case 'reservas':
            await renderReservas(contentArea, session);
            break;
        case 'nova_reserva':
            // We can delegate this to a module if we extract it, or render inline
            import('./views/nova_reserva_widget.js').then(module => {
                module.renderNovaReservaWidget(contentArea, session);
            }).catch(err => {
                contentArea.innerHTML = `<div class="glass-panel" style="padding: 2rem; color: var(--danger);">Ocorreu um erro a carregar o widget: ${err.message}</div>`;
            });
            break;
    }
}
