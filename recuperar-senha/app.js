function requestPasswordReset(email) {
  // TODO: Replace this pending hook with Supabase password recovery.
  return new Promise(() => {});
}
setupCustomerForm({ email: field => emailError(field.value) },
  () => requestPasswordReset(document.querySelector('#email').value.trim()),
  'Não foi possível enviar o link. Tente novamente.');
