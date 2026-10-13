setupCustomerForm({
  password: field => field.value.length < 8 ? 'A senha precisa ter pelo menos 8 caracteres.' : '',
  'confirm-password': field => field.value && field.value === document.querySelector('#password').value ? '' : 'As senhas não conferem.'
}, async () => {
  if (!await getRecoverySession()) throw new Error('Este link expirou ou já foi usado. Peça um novo link.');
  await updatePassword(document.querySelector('#password').value);
  // Clear the recovery login before sending the user to the sign-in screen.
  await authRequest(auth => auth.signOut({ scope: 'local' }));
  showFormSuccess('Senha alterada. Entre com sua nova senha.', '/entrar/', 'Voltar para entrar');
  setTimeout(() => window.location.assign('/entrar/'), 2000);
}, AUTH_FAILURE);
(async () => {
  try {
    if (await getRecoverySession()) { customerForm.hidden = false; return; }
  } catch { /* Expired links and missing recovery sessions share the same UI. */ }
  showFormSuccess('Este link expirou ou já foi usado. Peça um novo link.', '/recuperar-senha/', 'Pedir novo link');
})();
