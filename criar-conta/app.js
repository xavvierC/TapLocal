function signUp({ name, email, password }) {
  // TODO: Replace the pending request with Supabase Auth and enable this success guard.
  const backendReady = false;
  const request = new Promise(() => {});
  return request.then(result => {
    // TODO: Build /area-do-cliente/ before enabling authenticated navigation.
    if (backendReady && result?.success) window.location.assign('/area-do-cliente/');
    return result;
  });
}
setupCustomerForm({
  name: field => !field.value.trim() ? 'Digite seu nome completo.' : field.value.trim().split(/\s+/).length < 2 ? 'Informe seu nome e sobrenome.' : '',
  email: field => emailError(field.value),
  password: field => field.value.length < 8 ? 'A senha precisa ter pelo menos 8 caracteres.' : '',
  'confirm-password': field => !field.value ? 'Confirme sua senha.' : field.value !== document.querySelector('#password').value ? 'As senhas não conferem.' : '',
  terms: field => field.checked ? '' : 'Você precisa aceitar os termos para continuar.'
}, () => signUp({
  name: document.querySelector('#name').value.trim(),
  email: document.querySelector('#email').value.trim(),
  password: document.querySelector('#password').value
}), 'Não foi possível criar sua conta. Tente novamente.');
