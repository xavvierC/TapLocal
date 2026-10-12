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
