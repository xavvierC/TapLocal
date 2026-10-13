const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const settingsValue=id=>document.getElementById(id).value.trim();
const settingsDigits=value=>value.replace(/\D/g,'');
const settingsRequired=(id,message)=>()=>settingsValue(id)?'':message;
function settingsMessage(node,message,error=false) { node.textContent=message; node.hidden=false; node.classList.toggle('error',error); }
function setupSettingsForm(id,rules,save,success) {
 const form=document.getElementById(id), button=form.querySelector('[type="submit"]'), result=form.querySelector('.settings-result');
 function validate(key) {
  const field=document.getElementById(key), message=rules[key]();
  const error=document.getElementById(`${key}-error`); error.textContent=message; error.hidden=!message;
  field.setAttribute('aria-invalid',String(Boolean(message))); return !message;
 }
 Object.keys(rules).forEach(key=>{
  const field=document.getElementById(key);
  field.addEventListener('input',()=>{ if(field.getAttribute('aria-invalid')==='true') validate(key); });
  field.addEventListener('blur',()=>validate(key));
  if(field.tagName==='SELECT') field.addEventListener('change',()=>validate(key));
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault(); if(button.disabled) return;
  result.hidden=true;
  const invalid=Object.keys(rules).filter(key=>!validate(key));
  if(invalid.length) { document.getElementById(invalid[0]).focus(); return; }
  button.disabled=true; button.setAttribute('aria-busy','true');
  try { await save(); settingsMessage(result,success); }
  catch { settingsMessage(result,'Não foi possível salvar. Tente novamente.',true); }
  finally { button.disabled=false; button.setAttribute('aria-busy','false'); }
 });
}
function setupSettingsMask(id,max,format) {
 const input=document.getElementById(id);
 input.addEventListener('input',()=>{ input.value=format(settingsDigits(input.value).slice(0,max)); });
}
(async()=>{
 let session;
 try { session=await requireCustomerSession(); if(!session) return; }
 catch { window.location.replace('/entrar/'); return; }
 const uid=session.user.id;
 let journey;
 try { journey=await loadCustomerJourney(uid); }
 catch {
  const error=document.getElementById('settings-error'); error.textContent=JOURNEY_FAILURE; error.hidden=false;
  document.body.style.visibility='visible'; return;
 }
 const profile=journey.profile || {};
 let hasProfile=Boolean(journey.profile), hasAddress=Boolean(journey.address);
 ['full_name','whatsapp','company_name','locality','instagram_handle'].forEach(key=>document.getElementById(key).value=profile[key] || '');
 const addressKeys=['cep','street','number','complement','district','city','state'];
 addressKeys.forEach(key=>document.getElementById(key).value=journey.address?.[key] || '');
 document.getElementById('current-email').textContent=`Seu e-mail atual é ${session.user.email || '—'}.`;
 const profileSave=async fields=>{
  const values=Object.fromEntries(fields.map(key=>[key,settingsValue(key)]));
  if(values.instagram_handle!==undefined) values.instagram_handle=values.instagram_handle.replace(/^@/,'');
  await journeyRequest(client=>hasProfile
   ? client.from('profiles').update(values).eq('user_id',uid).select('user_id').single()
   : client.from('profiles').insert({user_id:uid,...values}).select('user_id').single());
  hasProfile=true;
 };
 setupSettingsForm('personal-form',{
  full_name:settingsRequired('full_name','Informe seu nome completo.'),
  whatsapp:()=>/^\d{10,11}$/.test(settingsDigits(settingsValue('whatsapp')))?'':'Informe um WhatsApp válido com DDD.'
 },()=>profileSave(['full_name','whatsapp']),'Seus dados foram salvos.');
 const addressRules={};
 for(const [key,label] of Object.entries({street:'a rua',number:'o número',district:'o bairro',city:'a cidade'})) addressRules[key]=settingsRequired(key,`Informe ${label}.`);
 addressRules.cep=()=>/^\d{8}$/.test(settingsDigits(settingsValue('cep')))?'':'Informe um CEP com 8 números.';
 addressRules.state=()=>UFS.includes(settingsValue('state'))?'':'Escolha o estado.';
 // Follow visual field order when focusing the first error.
 const orderedRules=Object.fromEntries(addressKeys.filter(key=>addressRules[key]).map(key=>[key,addressRules[key]]));
 setupSettingsForm('address-form',orderedRules,async()=>{
  const values=Object.fromEntries(addressKeys.map(key=>[key,settingsValue(key)]));
  await journeyRequest(client=>hasAddress
   ? client.from('addresses').update(values).eq('user_id',uid).select('id').single()
   : client.from('addresses').insert({user_id:uid,...values}).select('id').single());
  hasAddress=true;
 },'Seu endereço foi salvo.');
 setupSettingsForm('company-form',{
  company_name:settingsRequired('company_name','Informe o nome da empresa como aparece no Google.'),
  locality:settingsRequired('locality','Informe a cidade e o bairro da empresa.'),
  instagram_handle:()=>!settingsValue('instagram_handle') || /^[a-z0-9._]{1,30}$/.test(settingsValue('instagram_handle').replace(/^@/,''))?'':'Use letras minúsculas, números, pontos e underscores, com até 30 caracteres.'
 },()=>profileSave(['company_name','locality','instagram_handle']),'Os dados da empresa foram salvos.');
 setupSettingsForm('email-form',{
  'new-email':()=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settingsValue('new-email'))?'':'Digite um e-mail válido.'
 },()=>authRequest(auth=>auth.updateUser({email:settingsValue('new-email')},{emailRedirectTo:window.location.origin+'/area-do-cliente/configuracoes/'})),'Confira os e-mails de confirmação para concluir a alteração.');
 setupSettingsMask('cep',8,raw=>raw.length>5?`${raw.slice(0,5)}-${raw.slice(5)}`:raw);
 setupSettingsMask('whatsapp',11,raw=>{
  if(!raw) return ''; if(raw.length<=2) return `(${raw}`;
  const local=raw.slice(2), split=local.length>8?5:4;
  return `(${raw.slice(0,2)}) ${local.slice(0,split)}${local.length>split?'-'+local.slice(split):''}`;
 });
 const reset=document.getElementById('reset-password');
 reset.addEventListener('click',async()=>{
  if(reset.disabled) return; reset.disabled=true; reset.setAttribute('aria-busy','true');
  try { await requestPasswordReset(session.user.email); settingsMessage(document.getElementById('reset-result'),'Confira seu e-mail para redefinir a senha.'); }
  catch { settingsMessage(document.getElementById('reset-result'),'Não foi possível enviar o link. Tente novamente.',true); }
  finally { reset.disabled=false; reset.setAttribute('aria-busy','false'); }
 });
 const plates=document.getElementById('settings-plates');
 if(!journey.plates.length) {
  const text=document.createElement('p'); text.textContent='Você ainda não tem placas.'; plates.append(text);
  const link=document.createElement('a'); link.href='/pedido/'; link.className='button secondary customer-action'; link.textContent='Monte seu pedido'; plates.append(link);
 }
 journey.plates.forEach((plate,index)=>{
  const form=document.createElement('form'); form.id=`plate-form-${index}`; form.className='customer-list-item'; form.noValidate=true; form.setAttribute('aria-label',`Configuração da placa ${index+1}`);
  const heading=document.createElement('h3'); heading.textContent=`Placa ${index+1} · ${plate.type==='google'?'Google':'Instagram'}`;
  const status=document.createElement('p'); status.textContent=plate.status==='configurada'?'Configurada':'Aguardando configuração'; status.setAttribute('aria-live','polite');
  const fieldId=`plate-url-${index}`;
  // Only trusted, generated IDs go into this template; all stored values use DOM properties.
  form.innerHTML=`<div class="login-field"><label for="${fieldId}">Link da placa</label><div class="login-input"><input id="${fieldId}" type="url" aria-invalid="false" aria-describedby="${fieldId}-help ${fieldId}-error"></div><p id="${fieldId}-help">Use um link HTTPS do ${plate.type==='google'?'Google ou g.page':'Instagram'}.</p><p id="${fieldId}-error" class="login-error" hidden></p></div><button type="submit" class="button primary customer-action">Salve o link</button><p class="settings-result" role="status" hidden></p>`;
  form.prepend(heading,status); plates.append(form);
  document.getElementById(fieldId).value=plate.configured_url || '';
  setupSettingsForm(form.id,{[fieldId]:()=>validPlateUrl(settingsValue(fieldId),plate.type)?'':'Informe um link HTTPS válido para este tipo de placa.'},async()=>{
   await journeyRequest(client=>client.from('plates').update({configured_url:new URL(settingsValue(fieldId)).href}).eq('id',plate.id).eq('user_id',uid).select('id').single());
   status.textContent='Configurada';
  },'O link foi salvo.');
 });
 document.getElementById('download-data').addEventListener('click',async event=>{
  const button=event.currentTarget; button.disabled=true;
  try {
   const data=await loadCustomerJourney(uid);
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
   const link=document.createElement('a'); link.href=url; link.download='taplocal-meus-dados.json'; document.body.append(link); link.click(); link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  } catch { settingsMessage(document.getElementById('download-result'),JOURNEY_FAILURE,true); }
  finally { button.disabled=false; }
 });
 setupSettingsForm('deletion-form',{
  'delete-confirmation':()=>settingsValue('delete-confirmation')==='EXCLUIR'?'':'Digite EXCLUIR para confirmar a solicitação.'
 },async()=>{
  const requests=await journeyRequest(client=>client.from('deletion_requests').select('id').eq('user_id',uid).eq('status','pendente').limit(1));
  if(!requests.length) await journeyRequest(client=>client.from('deletion_requests').insert({user_id:uid}));
 },'Recebemos seu pedido. Responderemos em até 15 dias, conforme a Política de privacidade.');
 document.getElementById('settings-content').hidden=false;
 document.body.style.visibility='visible';
 if(window.location.hash==='#placas') document.getElementById('placas').scrollIntoView();
})();
