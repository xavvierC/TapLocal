function isAuthenticated() {
  // TODO: Read the Supabase session here when authentication is connected.
  return false;
}
function signOut() {
  // TODO: Call Supabase Auth here; do not simulate logout or redirect.
  return new Promise(() => {});
}
function refreshAccountState() {
  const authenticated = isAuthenticated();
  const menu = document.querySelector('#account-menu');
  menu.querySelectorAll('[data-account-guest]').forEach(item => { item.hidden = authenticated; });
  menu.querySelectorAll('[data-account-member]').forEach(item => { item.hidden = !authenticated; });
  menu.querySelectorAll('.account-divider').forEach(divider => {
    divider.hidden = divider.previousElementSibling.hidden || divider.nextElementSibling.hidden;
  });
}

// One controller owns both header menus on every page.
(() => {
  const account = document.querySelector('.account-control');
  const trigger = account.querySelector('.account-trigger');
  const menu = account.querySelector('#account-menu');
  const mobileTrigger = document.querySelector('.menu-trigger');
  const mobileMenu = document.querySelector('#mobile-nav');
  const items = () => [...menu.querySelectorAll('[role="menuitem"]')].filter(item => !item.hidden);
  function setMobileOpen(open, restoreFocus = false) {
    if (open) setAccountOpen(false);
    mobileMenu.hidden = !open;
    mobileTrigger.setAttribute('aria-expanded', String(open));
    mobileTrigger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    if (restoreFocus) mobileTrigger.focus();
  }
  function setAccountOpen(open, focusIndex) {
    if (open) { setMobileOpen(false); refreshAccountState(); }
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open && focusIndex !== undefined) items()[focusIndex]?.focus();
  }
  refreshAccountState();
  trigger.addEventListener('click', () => setAccountOpen(menu.hidden, 0));
  trigger.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setAccountOpen(true, event.key === 'ArrowUp' ? items().length - 1 : 0);
    }
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Tab') { setTimeout(() => setAccountOpen(false), 0); return; }
    const visible = items();
    const index = visible.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % visible.length;
    if (event.key === 'ArrowUp') next = (index - 1 + visible.length) % visible.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = visible.length - 1;
    if (next !== undefined) { event.preventDefault(); visible[next].focus(); }
  });
  document.addEventListener('focusin', event => {
    if (!account.contains(event.target)) setAccountOpen(false);
  });
  menu.addEventListener('click', event => {
    if (event.target.closest('[data-sign-out]')) void signOut();
    if (event.target.closest('[role="menuitem"]')) setAccountOpen(false);
  });
  mobileTrigger.addEventListener('click', () => setMobileOpen(mobileMenu.hidden));
  mobileMenu.addEventListener('click', event => { if (event.target.closest('a')) setMobileOpen(false); });
  document.addEventListener('click', event => {
    if (!account.contains(event.target)) setAccountOpen(false);
    if (!event.target.closest('.header')) setMobileOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!menu.hidden) { event.preventDefault(); setAccountOpen(false); trigger.focus(); }
    else if (!mobileMenu.hidden) setMobileOpen(false, true);
  });
  matchMedia('(min-width:1024px)').addEventListener('change', () => setAccountOpen(false));
  matchMedia('(min-width:1100px)').addEventListener('change', event => { if (event.matches) setMobileOpen(false); });
})();
