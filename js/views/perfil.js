export async function renderPerfil(container, session) {
    let html = `
        <div class="glass-panel" style="padding: 2rem; max-width: 600px; margin: 0 auto;">
            <div style="margin-bottom: 2rem; text-align: center;">
                <h2>O Meu Perfil</h2>
                <p class="text-sub" style="font-size: 0.9rem;">Consulte os seus dados e altere as suas credenciais.</p>
            </div>

            <div style="margin-bottom: 2rem; padding: 1.5rem; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 50px; height: 50px; border-radius: 50%; background: var(--primary-color); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: bold;">
                        ${session.user.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p style="margin: 0; font-size: 0.85rem;" class="text-sub">E-mail associado à conta:</p>
                        <p style="margin: 0; font-weight: bold; font-size: 1.1rem;">${escapeHTML(session.user.email)}</p>
                    </div>
                </div>
            </div>

            <h3 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Alterar Password</h3>
            <form id="formPerfilPassword">
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>Password Atual</label>
                    <input type="password" id="oldPassword" class="form-control" required placeholder="Digite a sua password atual">
                </div>
                <div class="form-group" style="margin-bottom: 1rem;">
                    <label>Nova Password</label>
                    <input type="password" id="newPassword" class="form-control" required placeholder="Digite a nova password (min 6 caracteres)">
                </div>
                <div class="form-group" style="margin-bottom: 1.5rem;">
                    <label>Confirmar Nova Password</label>
                    <input type="password" id="confirmPassword" class="form-control" required placeholder="Repita a nova password">
                </div>
                
                <p id="perfilMsg" style="display: none; margin-bottom: 1rem; padding: 0.75rem; border-radius: 8px; font-size: 0.85rem;"></p>
                
                <div style="text-align: right;">
                    <button type="submit" class="btn btn-primary" id="btnSalvarPassword">
                        <i class="fa-solid fa-floppy-disk"></i> Atualizar Password
                    </button>
                </div>
            </form>
        </div>
    `;

    container.innerHTML = html;

    const form = document.getElementById('formPerfilPassword');
    const msgInfo = document.getElementById('perfilMsg');
    const btnSalvar = document.getElementById('btnSalvarPassword');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPass = document.getElementById('oldPassword').value;
        const newPass = document.getElementById('newPassword').value;
        const confPass = document.getElementById('confirmPassword').value;

        // Reset message
        msgInfo.style.display = 'none';
        msgInfo.className = '';

        if (newPass !== confPass) {
            showMessage("A nova password e a confirmação não coincidem.", "error");
            return;
        }

        if (newPass.length < 6) {
            showMessage("A nova password tem de ter pelo menos 6 caracteres.", "error");
            return;
        }

        btnSalvar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A atualizar...';
        btnSalvar.disabled = true;

        try {
            // 1. Validar a password antiga fazendo SignIn localmente com o email atual
            const { data: signInData, error: signInError } = await window.supabase.auth.signInWithPassword({
                email: session.user.email,
                password: oldPass
            });

            if (signInError) {
                showMessage("A password atual está incorreta.", "error");
                resetButton();
                return;
            }

            // 2. Se a autenticação foi sucedida, atualizamos a password do user
            const { data: updateData, error: updateError } = await window.supabase.auth.updateUser({
                password: newPass
            });

            if (updateError) {
                showMessage("Erro ao atualizar password: " + updateError.message, "error");
            } else {
                showMessage("Password alterada com sucesso!", "success");
                form.reset();
            }
        } catch (err) {
            showMessage("Erro inesperado: " + err.message, "error");
        } finally {
            resetButton();
        }
    });

    function showMessage(msg, type) {
        msgInfo.textContent = msg;
        msgInfo.style.display = 'block';
        if (type === 'error') {
            msgInfo.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
            msgInfo.style.color = '#ef4444';
            msgInfo.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        } else {
            msgInfo.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
            msgInfo.style.color = '#22c55e';
            msgInfo.style.border = '1px solid rgba(34, 197, 94, 0.3)';
        }
    }

    function resetButton() {
        btnSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Atualizar Password';
        btnSalvar.disabled = false;
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
