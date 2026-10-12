// Visual-only hook: TODO integrate Supabase Auth here in a later step.
// No authentication, success simulation, navigation, or persistence occurs.
function signIn(email, password) {
  return new Promise(() => {});
}

const form = document.querySelector('#login-form');
const email = document.querySelector('#email');
const password = document.querySelector('#password');
const toggle = document.querySelector('.password-toggle');
const submit = document.querySelector('.login-submit');
const validEmail = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
function validate(field, valid) {
  field.setAttribute('aria-invalid', String(!valid));
  document.querySelector(`#${field.id}-error`).hidden = valid;
  return valid;
}
email.addEventListener('blur', () => validate(email, validEmail()));
email.addEventListener('input', () => {
  if (validEmail()) validate(email, true);
});
password.addEventListener('input', () => {
  if (password.value.length) validate(password, true);
});
toggle.addEventListener('click', () => {
  const visible = password.type === 'password';
  password.type = visible ? 'text' : 'password';
  toggle.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
  toggle.setAttribute('aria-pressed', String(visible));
});
form.addEventListener('submit', event => {
  event.preventDefault();
  if (submit.disabled) return;
  const emailOK = validate(email, validEmail());
  const passwordOK = validate(password, password.value.length > 0);
  if (!emailOK || !passwordOK) {
    (!emailOK ? email : password).focus();
    return;
  }
  submit.disabled = true;
  submit.setAttribute('aria-busy', 'true');
  submit.querySelector('.login-arrow').hidden = true;
  submit.querySelector('.login-spinner').hidden = false;
  void signIn(email.value.trim(), password.value);
});

// Match the existing public header behavior without loading the Hero controller.
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
