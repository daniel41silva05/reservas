// Configure as suas chaves do Supabase aqui
// NOTA: Sendo o repositório público, a "anon key" e a "URL" podem ficar expostas no frontend SEM PROBLEMA,
// DESDE QUE configure o Row Level Security (RLS) corretamente na base de dados para proteger os dados.
// NUNCA cole aqui a sua "service_role" key.

const SUPABASE_URL = typeof window.ENV !== 'undefined' ? window.ENV.SUPABASE_URL : 'COLE_AQUI';
const SUPABASE_ANON_KEY = typeof window.ENV !== 'undefined' ? window.ENV.SUPABASE_ANON_KEY : 'COLE_AQUI';

// Inicia o cliente Supabase globalmente
if (SUPABASE_URL.includes('COLE_AQUI') || SUPABASE_URL === 'SUA_URL_AQUI') {
    console.warn("Atenção: Supabase URL e Anon Key não estão configurados.");
} else {
    window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
