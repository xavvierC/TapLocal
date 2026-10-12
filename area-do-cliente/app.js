(async () => {
  try {
    const session = await getSession();
    if (!session) { window.location.replace('/entrar/'); return; }
    const rawName = session.user.user_metadata?.full_name;
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    document.querySelector('#customer-name').textContent = name || '—';
    document.querySelector('#customer-email').textContent = session.user.email || '—';
    if (name) document.querySelector('#customer-greeting').textContent = `Olá, ${name.split(/\s+/)[0]}.`;
    document.body.style.visibility = 'visible';
  } catch { window.location.replace('/entrar/'); }
})();
