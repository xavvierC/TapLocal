// Public browser credentials. Authentication only; no business-data access.
const AUTH_URL = 'https://zkemvzzzloeqzegxeflw.supabase.co';
const AUTH_KEY = 'sb_publishable_GbkHpo5_x637SECY6FMYLw_GG8MCavQ';
const AUTH_FAILURE = 'Não foi possível concluir. Tente novamente.';
let recoverySessionReceived = false;
window.taplocalSupabase = window.supabase?.createClient(AUTH_URL, AUTH_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: {
    // Abort stalled requests instead of leaving a form loading indefinitely.
    fetch: async (input, options = {}) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try { return await fetch(input, { ...options, signal: controller.signal }); }
      finally { clearTimeout(timer); }
    }
  }
}) || null;
function authErrorMessage(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message === 'user already registered' || error?.code === 'user_already_exists') return 'Este e-mail já tem uma conta. Entre ou recupere sua senha.';
  if (message === 'invalid login credentials' || error?.code === 'invalid_credentials') return 'E-mail ou senha incorretos.';
  if (message === 'email not confirmed' || error?.code === 'email_not_confirmed') return 'Confirme seu e-mail antes de entrar.';
  return AUTH_FAILURE;
}
async function authRequest(request) {
  if (!window.taplocalSupabase) throw new Error(AUTH_FAILURE);
  let timer;
  try {
    const result = await Promise.race([
      request(window.taplocalSupabase.auth),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(AUTH_FAILURE)), 30000); })
    ]);
    if (result.error) throw result.error;
    return result.data;
  } catch (error) { throw new Error(authErrorMessage(error)); }
  finally { clearTimeout(timer); }
}
async function getSession() {
  const data = await authRequest(auth => auth.getSession());
  return data.session || null;
}
async function isAuthenticated() { return Boolean(await getSession()); }
async function signUp({ name, email, password }) {
  return authRequest(auth => auth.signUp({ email, password, options: {
    data: { full_name: name }, emailRedirectTo: window.location.origin + '/area-do-cliente/'
  } }));
}
async function signIn(email, password) {
  return authRequest(auth => auth.signInWithPassword({ email, password }));
}
async function requestPasswordReset(email) {
  return authRequest(auth => auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/redefinir-senha/' }));
}
async function updatePassword(newPassword) {
  return authRequest(auth => auth.updateUser({ password: newPassword }));
}
async function signOut() {
  await authRequest(auth => auth.signOut());
  window.location.assign('/');
}
async function getRecoverySession() {
  const session = await getSession();
  return recoverySessionReceived ? session : null;
}
async function redirectAuthenticatedVisitor() {
  try { if (await isAuthenticated()) window.location.replace(customerReturnPath()); }
  catch { /* The form can display a mapped error if initialization fails. */ }
}
window.taplocalSupabase?.auth.onAuthStateChange((event, session) => {
  // Keep callbacks synchronous: calling Auth methods here can deadlock the SDK.
  if (event === 'PASSWORD_RECOVERY') recoverySessionReceived = true;
  if (event === 'SIGNED_OUT') recoverySessionReceived = false;
  window.dispatchEvent(new CustomEvent('taplocal-auth-change', { detail: { authenticated: Boolean(session) } }));
});

function customerReturnPath() {
  const next = new URLSearchParams(window.location.search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/area-do-cliente/';
  try {
    const destination = new URL(next, window.location.origin);
    const allowed = ['/pedido/', '/area-do-cliente/', '/area-do-cliente/configuracoes/'];
    return destination.origin === window.location.origin && allowed.includes(destination.pathname)
      ? destination.pathname + destination.search + destination.hash : '/area-do-cliente/';
  } catch { return '/area-do-cliente/'; }
}