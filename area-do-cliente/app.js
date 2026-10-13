const CUSTOMER_STATUS = {
 aguardando_pagamento:'Aguardando pagamento', pago:'Pago', em_producao:'Em produção',
 enviado:'Enviado', entregue:'Entregue', cancelado:'Cancelado'
};
function customerNode(tag, text, className) {
 const node=document.createElement(tag); if(text) node.textContent=text; if(className) node.className=className; return node;
}
function customerLink(text, href) {
 const link=customerNode('a',text,'button primary customer-action'); link.href=href; return link;
}
function emptyCustomerState(container, message) {
 container.append(customerNode('p',message,'customer-empty'),customerLink('Monte seu pedido','/pedido/'));
}
function createDeleteIcon() {
 const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
 icon.setAttribute('viewBox','0 0 24 24'); icon.setAttribute('aria-hidden','true');
 icon.innerHTML='<path d="M4 7h16m-10 4v6m4-6v6M9 7V4h6v3m-9 0 1 13h10l1-13"/>'; return icon;
}
function confirmPlateDelete() {
 return new Promise(resolve => {
  const dialog=document.createElement('dialog'); dialog.className='customer-delete-dialog';
  const title=customerNode('h2','Excluir placa?');
  const message=customerNode('p','Essa ação não pode ser desfeita.');
  const actions=customerNode('div',null,'customer-delete-dialog-actions');
  const cancel=customerNode('button','Cancelar','button secondary'); cancel.type='button';
  const confirm=customerNode('button','Excluir','button primary customer-delete-confirm'); confirm.type='button';
  actions.append(cancel,confirm); dialog.append(title,message,actions); document.body.append(dialog);
  const finish=value => { if(dialog.open) dialog.close(); dialog.remove(); resolve(value); };
  cancel.addEventListener('click',()=>finish(false)); confirm.addEventListener('click',()=>finish(true));
  dialog.addEventListener('cancel',event=>{ event.preventDefault(); finish(false); });
  dialog.showModal(); cancel.focus();
 });
}
async function renderCustomerPlates(plates, orders, session) {
 const container=document.querySelector('#customer-plates'); container.replaceChildren();
 document.querySelector('#count-plates').textContent=plates.length;
 document.querySelector('#count-links').textContent=plates.filter(plate=>plate.status==='configurada').length;
 if(!plates.length) { emptyCustomerState(container,'Você ainda não tem placas.'); return; }
 const ordersById=new Map(orders.map(order=>[order.id,order]));
 plates.forEach((plate,index)=>{
  const item=customerNode('article',null,'customer-list-item');
  item.append(customerNode('h3',`Placa ${index+1} · ${plate.type==='google'?'Google':'Instagram'}`));
  item.append(customerNode('p',plate.status==='configurada'?'Configurada':'Aguardando configuração'));
  if(plate.status!=='configurada') {
   const guide=customerNode('ol');
   ['Abra a página da sua empresa no Google ou o perfil no Instagram.','Copie o link completo da página.','Abra as configurações e salve o link na placa correspondente.'].forEach(text=>guide.append(customerNode('li',text)));
   item.append(guide);
  }
  item.append(customerLink('Configure sua placa','/area-do-cliente/configuracoes/#placas'));
  const orderStatus=ordersById.get(plate.order_id)?.status;
  if(orderStatus==='aguardando_pagamento' || orderStatus==='cancelado') {
   const remove=customerNode('button','Excluir placa','button secondary customer-delete-action'); remove.type='button';
   remove.prepend(createDeleteIcon());
   remove.addEventListener('click',async()=>{
    if(!await confirmPlateDelete()) return;
    remove.disabled=true;
    try {
     await journeyRequest(client=>client.from('plates').delete().eq('id',plate.id).eq('user_id',session.user.id).select('id').maybeSingle());
     const refreshed=await loadCustomerJourney(session.user.id);
     await renderCustomerPlates(refreshed.plates,refreshed.orders,session);
    } catch {
     remove.disabled=false;
     const error=document.querySelector('#customer-data-error'); error.textContent=JOURNEY_FAILURE; error.hidden=false;
    }
   });
   item.append(remove);
  }
  container.append(item);
 });
}
(async () => {
 let session;
 try { session=await requireCustomerSession(); if(!session) return; }
 catch { window.location.replace('/entrar/'); return; }
 document.querySelector('#customer-email').textContent=session.user.email || '—';
 try {
  const data=await loadCustomerJourney(session.user.id);
  const name=data.profile?.full_name?.trim() || '';
  document.querySelector('#customer-name').textContent=name || '—';
  document.querySelector('#customer-greeting').textContent=name ? `Olá, ${name.split(/\s+/)[0]}.` : 'Olá.';
  ['orders'].forEach(key => { document.querySelector(`#count-${key}`).textContent=data[key].length; });
  const orders=document.querySelector('#customer-orders');
  if(!data.orders.length) emptyCustomerState(orders,'Você ainda não fez um pedido.');
  for(const order of data.orders) {
   const item=customerNode('article',null,'customer-list-item');
   item.append(customerNode('h3',({kit:'Kit Negócio',duo:'Duo TapLocal','individual-google':'Individual Google','individual-instagram':'Individual Instagram'})[order.product]));
   item.append(customerNode('p',CUSTOMER_STATUS[order.status] || 'O status não está disponível.'));
   item.append(customerNode('p',`${order.quantity.google} Google, ${order.quantity.instagram} Instagram`));
   if(order.paid_at) {
    const deadline=new Date(order.paid_at); deadline.setUTCDate(deadline.getUTCDate()+15);
    item.append(customerNode('p',`Prazo de entrega: até ${deadline.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}`));
   }
   orders.append(item);
  }
  await renderCustomerPlates(data.plates,data.orders,session);
 } catch {
  const error=document.querySelector('#customer-data-error'); error.textContent=JOURNEY_FAILURE; error.hidden=false;
  document.querySelectorAll('.customer-summary dd').forEach(node=>node.textContent='—');
 }
 document.body.style.visibility='visible';
})();
