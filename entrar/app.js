void redirectAuthenticatedVisitor();

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
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submit.disabled) return;
  const error = document.querySelector('#form-error');
  error.hidden = true;
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
  try {
    const data = await signIn(email.value.trim(), password.value);
    if (!data.session) throw new Error(AUTH_FAILURE);
    window.location.assign('/area-do-cliente/');
  } catch (failure) {
    error.textContent = failure.message;
    error.hidden = false;
    submit.disabled = false;
    submit.setAttribute('aria-busy', 'false');
    submit.querySelector('.login-arrow').hidden = false;
    submit.querySelector('.login-spinner').hidden = true;
  }
});
