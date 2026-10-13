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
  ['orders','plates','links'].forEach(key => {
   document.querySelector(`#count-${key}`).textContent=key==='links' ? data.plates.filter(p=>p.status==='configurada').length : data[key].length;
  });
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
  const plates=document.querySelector('#customer-plates');
  if(!data.plates.length) emptyCustomerState(plates,'Você ainda não tem placas.');
  data.plates.forEach((plate,index)=>{
   const item=customerNode('article',null,'customer-list-item');
   item.append(customerNode('h3',`Placa ${index+1} · ${plate.type==='google'?'Google':'Instagram'}`));
   item.append(customerNode('p',plate.status==='configurada'?'Configurada':'Aguardando configuração'));
   if(plate.status!=='configurada') {
    const guide=customerNode('ol');
    ['Abra a página da sua empresa no Google ou o perfil no Instagram.','Copie o link completo da página.','Abra as configurações e salve o link na placa correspondente.'].forEach(text=>guide.append(customerNode('li',text)));
    item.append(guide);
   }
   item.append(customerLink('Configure sua placa','/area-do-cliente/configuracoes/#placas')); plates.append(item);
  });
 } catch {
  const error=document.querySelector('#customer-data-error'); error.textContent=JOURNEY_FAILURE; error.hidden=false;
  document.querySelectorAll('.customer-summary dd').forEach(node=>node.textContent='—');
 }
 document.body.style.visibility='visible';
})();
