// Shared customer-data access. RLS and SQL column grants enforce ownership on the server.
const JOURNEY_FAILURE = 'Não foi possível carregar ou salvar seus dados. Tente novamente.';
async function journeyRequest(request) {
  if (!window.taplocalSupabase) throw new Error(JOURNEY_FAILURE);
  let timer;
  try {
    const result = await Promise.race([
      request(window.taplocalSupabase),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(JOURNEY_FAILURE)), 30000); })
    ]);
    if (result.error) throw new Error(JOURNEY_FAILURE);
    return result.data;
  } catch { throw new Error(JOURNEY_FAILURE); }
  finally { clearTimeout(timer); }
}
async function requireCustomerSession() {
  const session = await getSession();
  if (!session) {
    // Only a route, never form values or personal data, is placed in the return URL.
    window.location.replace('/entrar/?next=' + encodeURIComponent(window.location.pathname + window.location.search + window.location.hash));
    return null;
  }
  return session;
}
async function loadCustomerJourney(userId) {
  const [profile, address, orders, plates] = await Promise.all([
    journeyRequest(client => client.from('profiles').select('*').eq('user_id', userId).maybeSingle()),
    journeyRequest(client => client.from('addresses').select('*').eq('user_id', userId).maybeSingle()),
    journeyRequest(client => client.from('orders').select('*').eq('user_id', userId).order('created_at', {ascending:false})),
    journeyRequest(client => client.from('plates').select('*').eq('user_id', userId))
  ]);
  return {profile, address, orders, plates};
}
function validPlateUrl(value, type) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (type === 'google' ? ['google.com','g.page'].includes(host) : host === 'instagram.com');
  } catch { return false; }
}
