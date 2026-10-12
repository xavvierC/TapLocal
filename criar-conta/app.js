void redirectAuthenticatedVisitor();
setupCustomerForm({
  name: field => !field.value.trim() ? 'Digite seu nome completo.' : field.value.trim().split(/\s+/).length < 2 ? 'Informe seu nome e sobrenome.' : '',
  email: field => emailError(field.value),
  password: field => field.value.length < 8 ? 'A senha precisa ter pelo menos 8 caracteres.' : '',
  'confirm-password': field => !field.value ? 'Confirme sua senha.' : field.value !== document.querySelector('#password').value ? 'As senhas não conferem.' : '',
  terms: field => field.checked ? '' : 'Você precisa aceitar os termos para continuar.'
}, async () => {
  const data = await signUp({
    name: document.querySelector('#name').value.trim(),
    email: document.querySelector('#email').value.trim(),
    password: document.querySelector('#password').value
  });
  if (data.session) { window.location.assign('/area-do-cliente/'); return; }
  showFormSuccess('Enviamos um link para confirmar seu e-mail. Abra sua caixa de entrada para ativar sua conta.', '/entrar/', 'Voltar para entrar');
}, AUTH_FAILURE);
