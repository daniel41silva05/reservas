// Esperar o DOM e o Supabase carregarem
document.addEventListener('DOMContentLoaded', async () => {
    // Referências aos elementos
    const loginFormContainer = document.getElementById('loginFormContainer');
    const loginForm = document.getElementById('loginForm');


    // Validar se já existe sessão, se sim, redirecionar para o dashboard
    if (window.supabase) {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session) {
            window.location.href = 'dashboard.html';
        }
    }

    // Toggle Password Visibility
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            // Toggle view icon
            const icon = togglePassword.querySelector('i');
            if (type === 'text') {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    }

    // Login Handler
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorMsg = document.getElementById('errorMsg');
        const loginBtn = document.getElementById('loginBtn');

        errorMsg.style.display = 'none';
        loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
        loginBtn.disabled = true;

        if (!window.supabase) {
            errorMsg.textContent = "Supabase não está configurado. Verifique o js/supabase-config.js.";
            errorMsg.style.display = 'block';
            loginBtn.innerHTML = 'Entrar no painel';
            loginBtn.disabled = false;
            return;
        }

        const { data, error } = await window.supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            errorMsg.textContent = "Erro: " + error.message;
            errorMsg.style.display = 'block';
            loginBtn.innerHTML = 'Entrar no painel';
            loginBtn.disabled = false;
        } else {
            // Sucesso
            window.location.href = 'dashboard.html';
        }
    });
});
