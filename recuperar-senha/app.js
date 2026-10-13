setupCustomerForm({ email: field => emailError(field.value) }, async () => {
  await requestPasswordReset(document.querySelector('#email').value.trim());
  showFormSuccess('Se este e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.', '/entrar/', 'Voltar para entrar');
}, AUTH_FAILURE);
