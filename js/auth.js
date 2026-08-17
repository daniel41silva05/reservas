// Esperar o DOM e o Supabase carregarem
document.addEventListener('DOMContentLoaded', async () => {
    // Referências aos elementos
    const loginFormContainer = document.getElementById('loginFormContainer');
    const registerFormContainer = document.getElementById('registerFormContainer');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');

    // Alternar vistas
    showRegisterBtn.addEventListener('click', () => {
        loginFormContainer.classList.add('hidden');
        registerFormContainer.classList.remove('hidden');
    });

    showLoginBtn.addEventListener('click', () => {
        registerFormContainer.classList.add('hidden');
        loginFormContainer.classList.remove('hidden');
    });

    // Validar se já existe sessão, se sim, redirecionar para o dashboard
    if (window.supabase) {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session) {
            window.location.href = 'dashboard.html';
        }
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

    // Register Handler
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const errorMsg = document.getElementById('regErrorMsg');
        const successMsg = document.getElementById('regSuccessMsg');
        const regBtn = document.getElementById('registerBtn');

        errorMsg.style.display = 'none';
        successMsg.style.display = 'none';
        regBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A registar...';
        regBtn.disabled = true;

        if (!window.supabase) {
            errorMsg.textContent = "Supabase não está configurado.";
            errorMsg.style.display = 'block';
            regBtn.innerHTML = 'Registar Negócio';
            regBtn.disabled = false;
            return;
        }

        const { data, error } = await window.supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (error) {
            errorMsg.textContent = "Erro: " + error.message;
            errorMsg.style.display = 'block';
        } else {
            successMsg.style.display = 'block';
        }

        regBtn.innerHTML = 'Registar Negócio';
        regBtn.disabled = false;
    });
});
