// Shared UI behavior for the new static customer forms.
const customerForm = document.querySelector('#login-form');
const customerSubmit = document.querySelector('.login-submit');
function setFormLoading(loading) {
  customerSubmit.disabled = loading;
  customerSubmit.setAttribute('aria-busy', String(loading));
  customerSubmit.querySelector('.login-arrow').hidden = loading;
  customerSubmit.querySelector('.login-spinner').hidden = !loading;
}
function showFormError(message) {
  const error = document.querySelector('#form-error');
  error.textContent = message;
  error.hidden = !message;
  setFormLoading(false);
}
function emailError(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? '' : 'Digite um e-mail válido.';
}
function setupCustomerForm(rules, submitRequest, failureMessage) {
  const fields = Object.keys(rules).map(id => document.getElementById(id));
  function validate(field) {
    const message = rules[field.id](field);
    const error = document.getElementById(`${field.id}-error`);
    error.textContent = message;
    error.hidden = !message;
    field.setAttribute('aria-invalid', String(Boolean(message)));
    return !message;
  }
  fields.forEach(field => {
    field.addEventListener(field.type === 'checkbox' ? 'change' : 'input', () => {
      if (field.getAttribute('aria-invalid') === 'true' || !rules[field.id](field)) validate(field);
      if (field.id === 'password') {
        const confirmation = document.querySelector('#confirm-password');
        if (confirmation && confirmation.value) validate(confirmation);
      }
    });
    if (field.type !== 'checkbox') field.addEventListener('blur', () => validate(field));
  });
  customerForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (customerSubmit.disabled) return;
    showFormError('');
    const invalid = fields.filter(field => !validate(field));
    if (invalid.length) { invalid[0].focus(); return; }
    setFormLoading(true);
    try { await submitRequest(); }
    catch { showFormError(failureMessage); }
  });
}
document.querySelectorAll('.password-toggle').forEach(toggle => {
  const input = document.getElementById(toggle.getAttribute('aria-controls'));
  const suffix = input.id === 'confirm-password' ? 'confirmação de senha' : 'senha';
  toggle.addEventListener('click', () => {
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-label', `${visible ? 'Ocultar' : 'Mostrar'} ${suffix}`);
    toggle.setAttribute('aria-pressed', String(visible));
  });
});

// Keep the existing public header interactions on the new pages.
const menuTrigger = document.querySelector('.menu-trigger');
const mobileNav = document.querySelector('#mobile-nav');
function setMenuOpen(open, restoreFocus = false) {
  mobileNav.hidden = !open;
  menuTrigger.setAttribute('aria-expanded', String(open));
  menuTrigger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  if (restoreFocus) menuTrigger.focus();
}
menuTrigger.addEventListener('click', () => setMenuOpen(mobileNav.hidden));
mobileNav.addEventListener('click', event => { if (event.target.closest('a')) setMenuOpen(false); });
document.addEventListener('click', event => { if (!event.target.closest('.header')) setMenuOpen(false); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mobileNav.hidden) setMenuOpen(false, true);
});
matchMedia('(min-width:1100px)').addEventListener('change', event => { if (event.matches) setMenuOpen(false); });
