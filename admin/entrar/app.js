(async function () {
 const form=document.getElementById('admin-login-form'),button=document.getElementById('login-submit'),error=document.getElementById('login-error');
 let busy=false;
 function showError(message) {error.textContent=message;error.hidden=false;}
 function loading(value) {busy=value;button.disabled=value;button.setAttribute('aria-busy',String(value));button.textContent=value?'Entrando…':'Entrar';}
 async function finishLogin() {
  if(await hasAdminAccess()) { window.location.replace('/admin/');return; }
  // Sign out without the public helper's redirect, so the denial stays visible.
  await authRequest(auth=>auth.signOut());
  showError('Acesso restrito');
 }
 document.getElementById('password-toggle').addEventListener('click',event=>{
  const input=document.getElementById('password'),visible=input.type==='password';
  input.type=visible?'text':'password';event.currentTarget.textContent=visible?'Ocultar':'Mostrar';
  event.currentTarget.setAttribute('aria-label',visible?'Ocultar senha':'Mostrar senha');event.currentTarget.setAttribute('aria-pressed',String(visible));
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!form.reportValidity()) return;
  error.hidden=true;loading(true);
  try {await signIn(document.getElementById('email').value.trim(),document.getElementById('password').value);await finishLogin();}
  catch {showError('Não foi possível entrar. Confira seus dados e tente novamente.');}
  finally {loading(false);}
 });
 try {if(await getSession()) {loading(true);await finishLogin();}}
 catch {showError('Não foi possível verificar o acesso. Tente novamente.');}
 finally {loading(false);}
})();
