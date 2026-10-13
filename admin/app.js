(async function () {
 'use strict';
 const page=document.body.dataset.page,feedback=document.getElementById('admin-feedback'),retry=document.getElementById('admin-retry');
 const view=document.getElementById('admin-view');
 let refresh=()=>{},ordersVersion=0,detailVersion=0,reportVersion=0,selectedId=null,selectedTrigger=null,reportRows=[],reportMonth='';
 function node(tag,text,className) {const result=document.createElement(tag);if(text!==undefined) result.textContent=text;if(className) result.className=className;return result;}
 function announce(message,error=false) {
  feedback.textContent=message;feedback.classList.toggle('admin-error',error);
  const detail=document.getElementById('order-detail');
  if(detail&&!detail.hidden) {
   let result=document.getElementById('detail-action-result');
   if(!result) {result=node('p');result.id='detail-action-result';result.setAttribute('role','status');detail.append(result);}
   result.textContent=message;result.classList.toggle('admin-error',error);
  }
 }
 function pill(status) {const element=node('span',ADMIN_STATUSES[status]||(status==='configurada'?'Configurada':'Aguardando configuração'),'admin-pill');element.dataset.status=status;return element;}
 function action(label,handler,primary=false) {
  const button=node('button',label,'admin-btn'+(primary?' admin-btn-primary':''));button.type='button';
  button.addEventListener('click',()=>handler(button));return button;
 }
 async function perform(button,task) {
  if(button.disabled) return;button.disabled=true;button.setAttribute('aria-busy','true');
  try {await task();announce('Alteração salva.');}
  catch {announce(ADMIN_FAILURE,true);}
  finally {button.disabled=false;button.setAttribute('aria-busy','false');}
 }
 function confirmAction(title,message,value) {
  const dialog=document.getElementById('admin-confirm'),field=document.getElementById('confirm-value');
  document.getElementById('confirm-title').textContent=title;document.getElementById('confirm-message').textContent=message;
  document.getElementById('confirm-value-label').hidden=value===undefined;field.required=value!==undefined;field.disabled=value===undefined;
  field.value=value===undefined?'':String(value);dialog.returnValue='';dialog.showModal();
  return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'?(value===undefined?true:Number(field.value)):null),{once:true}));
 }
 function stat(label,value,index=0) {
  const item=node('section',undefined,'admin-stat'),title=node('div',undefined,'admin-stat-title');
  const icon=node('span',undefined,'admin-stat-icon');icon.setAttribute('aria-hidden','true');
  icon.dataset.kind=['payment','paid','configuration','deletion'][index%4];
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','admin-icon');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d',['M4 5h16v14H4Zm0 5h16','M12 3v18m4-15H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H8','M4 5h16v14H4Zm4 5h8m-8 4h4','M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15'][index%4]);svg.append(path);icon.append(svg);
  title.append(icon,node('p',label));item.append(title,node('strong',String(value)));return item;
 }
 function orderTable(rows,container,onSelect,report=false) {
  container.replaceChildren();
  if(!rows.length) {container.append(node('p',page==='Pedidos'?'Nenhum pedido encontrado com esses filtros.':'Nenhum pedido encontrado neste período.','admin-empty'));return;}
  const headers=[page==='Painel'?'Cliente':'Empresa','Produto','Status',report?'Pagamento':'Data'];if(report) headers.push('Valor');
  const table=node('table',undefined,'admin-table'),head=node('thead'),headRow=node('tr'),body=node('tbody');
  headers.forEach(label=>{const th=node('th',label);th.scope='col';headRow.append(th);});head.append(headRow);
  rows.forEach(order=>{
   const row=node('tr');const cells=[order.company_name||'—',ADMIN_PRODUCTS[order.product]||'—',pill(order.status),adminDate(report?order.paid_at:order.created_at)];
   if(report) cells.push(adminMoney(order.price_cents));
   cells.forEach((value,index)=>{const td=node('td');td.dataset.label=headers[index];if(value instanceof Node) td.append(value);else td.textContent=value;row.append(td);});
   if(onSelect) {
    row.dataset.id=order.id;row.tabIndex=0;row.setAttribute('aria-label','Abrir pedido de '+(order.company_name||'cliente'));
    row.setAttribute('aria-selected',String(selectedId===order.id));row.addEventListener('click',()=>onSelect(order,row));
    row.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ') {event.preventDefault();onSelect(order,row);}});
   }
   body.append(row);
  });table.append(head,body);container.append(table);
 }
 async function dashboard() {
  const [start,end]=adminMonthRange(adminCurrentMonth());
  const [waiting,paid,plates,deletions,inventory,latest]=await Promise.all([
   adminCount('orders',q=>q.eq('status','aguardando_pagamento')),
   adminCount('orders',q=>q.gte('paid_at',start).lt('paid_at',end)),
   adminCount('plates',q=>q.eq('status','aguardando_configuracao')),
   adminCount('deletion_requests',q=>q.eq('status','pendente')),
   adminRows('inventory',q=>q.order('id')),
   adminRequest(client=>client.from('orders').select('*').order('created_at',{ascending:false}).order('id').limit(5))
  ]);
  const stats=document.getElementById('dashboard-stats');stats.replaceChildren(...['Aguardando pagamento','Pagos neste mês','Placas aguardando configuração','Solicitações de exclusão'].map((label,i)=>stat(label,[waiting,paid,plates,deletions][i],i)));
  const stock=document.getElementById('inventory');stock.replaceChildren();
  inventory.forEach(item=>{
   const row=node('div',undefined,'admin-stock'),image=node('img');image.src='/assets/'+item.id+'-plaque-portrait.png';image.alt='';image.width=84;image.height=100;
   const text=node('div');text.append(node('h3',item.label),node('p',item.stock_count+' disponíveis'));
   row.append(image,text,action('Ajustar',async button=>{
    const count=await confirmAction('Ajustar estoque','Confirme a quantidade disponível de '+item.label+'.',item.stock_count);
    if(count===null||!Number.isInteger(count)||count<0||count>2147483647) return;
    await perform(button,async()=>{await adminUpdate('inventory',item.id,{stock_count:count},'stock_count',item.stock_count);await dashboard();});
   }));stock.append(row);
  });
  orderTable(latest.data,document.getElementById('latest-orders'),order=>window.location.assign('/admin/pedidos/?id='+encodeURIComponent(order.id)));
 }
 function closeDetail() {
  ++detailVersion;selectedId=null;document.getElementById('order-detail').hidden=true;
  updateSheet();
  document.querySelectorAll('#orders-table tr[aria-selected]').forEach(row=>row.setAttribute('aria-selected','false'));
  const url=new URL(window.location.href);url.searchParams.delete('id');history.replaceState(null,'',url.pathname+url.search);
  if(selectedTrigger?.isConnected) selectedTrigger.focus();else document.getElementById('company-search').focus();
  selectedTrigger=null;
 }
 async function openOrder(order,trigger) {
  const version=++detailVersion;selectedId=order.id;selectedTrigger=trigger||selectedTrigger;
  const detail=document.getElementById('order-detail');detail.hidden=false;
  const loadingTitle=node('h2','Carregando o pedido.');loadingTitle.id='detail-title';
  const loadingClose=action('Fechar pedido',closeDetail);detail.replaceChildren(loadingTitle,loadingClose);
  updateSheet();
  loadingClose.focus();
  const url=new URL(window.location.href);url.searchParams.set('id',order.id);history.replaceState(null,'',url.pathname+url.search);
  document.querySelectorAll('#orders-table tr[data-id]').forEach(row=>row.setAttribute('aria-selected',String(row.dataset.id===order.id)));
  try {
   const [profile,address,plates]=await Promise.all([
    adminRequest(client=>client.from('profiles').select('full_name,whatsapp').eq('user_id',order.user_id).maybeSingle()),
    adminRequest(client=>client.from('addresses').select('*').eq('user_id',order.user_id).maybeSingle()),
    adminRows('plates',q=>q.eq('order_id',order.id).order('type').order('id'))
   ]);
   if(version!==detailVersion) return;
   detail.replaceChildren();
   const heading=node('div',undefined,'admin-detail-header'),title=node('h2','Pedido de '+(order.company_name||'cliente'));title.id='detail-title';
   const close=action('×',()=>closeDetail());close.setAttribute('aria-label','Fechar pedido');heading.append(title,close);
   detail.append(heading,node('p','#'+order.id.slice(0,8)+' · '+adminDate(order.created_at),'admin-muted'));
   function block(label,lines) {detail.append(node('h3',label));const content=node('div',undefined,'admin-detail-block');lines.forEach(line=>content.append(node('p',line)));detail.append(content);}
   block('Cliente',[profile.data?.full_name||'—','WhatsApp: '+(profile.data?.whatsapp||'—')]);
   const a=address.data;
   block('Endereço de entrega',a?[a.street+', '+a.number+(a.complement?', '+a.complement:''),a.district,a.city+'/'+a.state,'CEP '+a.cep]:['Endereço não informado.']);
   block('Empresa',[order.company_name||'—','Cidade e bairro: '+order.locality,'Instagram: '+(order.instagram_handle?'@'+order.instagram_handle:'—'),'Observação: '+(order.observation||'Nenhuma')]);
   detail.append(node('h3','Placas'));const list=node('ul',undefined,'admin-detail-block');
   plates.forEach(plate=>{const item=node('li');item.append(node('p',plate.type==='google'?'Google':'Instagram'),pill(plate.status));appendPlateLink(item,plate);list.append(item);});
   if(!plates.length) list.append(node('li','Nenhuma placa encontrada.'));detail.append(list);
   detail.append(node('h3','Status do pedido'));const label=node('label',undefined,'admin-field');label.htmlFor='order-status';label.append(node('span','Status do pedido'));
   const select=node('select');select.id='order-status';[order.status,...ADMIN_TRANSITIONS[order.status]].forEach(status=>select.append(new Option(ADMIN_STATUSES[status],status)));label.append(select);detail.append(label);
   const save=action('Salvar status',async button=>{
    if(select.value===order.status) return;
    const next=select.value;
    if(!await confirmAction('Salvar status','Confirme a mudança de '+ADMIN_STATUSES[order.status]+' para '+ADMIN_STATUSES[next]+'.'+(next==='pago'?' O estoque será reduzido conforme as placas deste pedido.':''))) return;
    await perform(button,async()=>{await adminUpdate('orders',order.id,{status:next},'status',order.status);await loadOrders();});
   },true);save.classList.add('admin-btn-wide');save.disabled=true;select.addEventListener('change',()=>{save.disabled=select.value===order.status;});detail.append(save);
   const copy=action('Copiar mensagem de WhatsApp',async button=>{
    const next={aguardando_pagamento:'Aguardamos a confirmação do pagamento.',pago:'Vamos iniciar a produção das suas placas.',em_producao:'Suas placas estão em produção.',enviado:'Seu pedido está a caminho.',entregue:'Seu pedido foi entregue.',cancelado:'Seu pedido foi cancelado.'};
    try {await navigator.clipboard.writeText('Olá, '+(profile.data?.full_name||'cliente')+'.\nSeu pedido TapLocal está com o status: '+ADMIN_STATUSES[order.status]+'.\n'+next[order.status]);button.textContent='Copiado';setTimeout(()=>{button.textContent='Copiar mensagem de WhatsApp';},2000);}
    catch {announce('Não foi possível copiar a mensagem. Tente novamente.',true);}
   });copy.classList.add('admin-btn-wide');detail.append(copy);close.focus();
  } catch {if(version===detailVersion) {detail.replaceChildren(node('p',ADMIN_FAILURE,'admin-error'),action('Fechar pedido',closeDetail));}}
 }
 function appendPlateLink(container,plate) {
  if(plate.configured_url&&validAdminLink(plate.configured_url,plate.type)) {
   const link=node('a',plate.configured_url);link.href=plate.configured_url;link.target='_blank';link.rel='noopener noreferrer';container.append(link);
  } else container.append(node('p','O cliente ainda não informou um link válido.','admin-muted'));
 }
 function validAdminLink(value,type) {
  try {const url=new URL(value),host=url.hostname.toLowerCase().replace(/^www\./,'');return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(type==='google'?['google.com','g.page'].includes(host):host==='instagram.com');}catch{return false;}
 }
 async function loadOrders() {
  const version=++ordersVersion,status=document.getElementById('status-filter').value,product=document.getElementById('product-filter').value,search=document.getElementById('company-search').value.trim();
  const rows=await adminRows('orders',q=>{
   if(status) q=q.eq('status',status);if(product) q=q.eq('product',product);
   if(search) q=q.ilike('company_name','%'+search.replace(/[\\%_]/g,'\\$&')+'%');
   return q.order('created_at',{ascending:false}).order('id');
  });
  if(version!==ordersVersion) return;
  orderTable(rows,document.getElementById('orders-table'),openOrder);
  if(selectedId) {
   let selected=rows.find(row=>row.id===selectedId);
   if(!selected&&/^[0-9a-f-]{36}$/i.test(selectedId)) selected=(await adminRequest(client=>client.from('orders').select('*').eq('id',selectedId).maybeSingle())).data;
   if(version!==ordersVersion) return;
   if(selected) await openOrder(selected,document.querySelector('#orders-table tr[data-id="'+selected.id+'"]'));else closeDetail();
  }
 }
 async function pendingPlates() {
  const [plates,profiles]=await Promise.all([adminRows('plates',q=>q.eq('status','aguardando_configuracao').order('order_id').order('id')),adminRows('profiles',q=>q.order('user_id'))]);
  const customers=new Map(profiles.map(row=>[row.user_id,row])),container=document.getElementById('plates-list');container.replaceChildren();
  if(!plates.length) {container.append(node('p','Nenhuma placa aguarda configuração.','admin-empty'));return;}
  plates.forEach(plate=>{
   const item=node('article',undefined,'admin-plate'),content=node('div');content.append(node('h3',plate.type==='google'?'Placa Google':'Placa Instagram'),node('p',customers.get(plate.user_id)?.full_name||'—'),node('p','Pedido #'+plate.order_id.slice(0,8),'admin-muted'));appendPlateLink(content,plate);
   const button=action('Marcar como configurada',async btn=>{
    if(!await confirmAction('Confirmar configuração','Confirme que você conferiu o link e configurou esta placa.')) return;
    await perform(btn,async()=>{await adminUpdate('plates',plate.id,{status:'configurada'},'status','aguardando_configuracao',plate.configured_url);await pendingPlates();});
   },true);button.disabled=!validAdminLink(plate.configured_url,plate.type);item.append(content,button);container.append(item);
  });
 }
 async function deletionRequests() {
  const [requests,profiles]=await Promise.all([adminRows('deletion_requests',q=>q.order('requested_at',{ascending:false}).order('id')),adminRows('profiles',q=>q.order('user_id'))]);
  const customers=new Map(profiles.map(row=>[row.user_id,row])),container=document.getElementById('requests-list');container.replaceChildren();
  if(!requests.length) {container.append(node('p','Nenhuma solicitação de exclusão foi recebida.','admin-empty'));return;}
  requests.forEach(request=>{
   const item=node('article',undefined,'admin-plate'),content=node('div'),deadline=new Date(request.requested_at);deadline.setUTCDate(deadline.getUTCDate()+15);
   content.append(node('h3',customers.get(request.user_id)?.full_name||'Cliente sem cadastro ativo'),node('p','Solicitada em '+adminDate(request.requested_at)),node('p','Prazo: '+adminDate(deadline)),node('p',request.status==='concluida'?'Concluída':'Pendente'));
   item.append(content);
   if(request.status==='pendente') item.append(action('Marcar como concluída',async button=>{
    if(!await confirmAction('Concluir exclusão','Confirme que você já excluiu manualmente os dados deste cliente. Esta ação registra a conclusão.')) return;
    await perform(button,async()=>{await adminUpdate('deletion_requests',request.id,{status:'concluida'},'status','pendente');await deletionRequests();});
   }));container.append(item);
  });
 }
 async function report() {
  const version=++reportVersion,month=document.getElementById('report-month').value,exportButton=document.getElementById('export-csv');exportButton.disabled=true;reportRows=[];
  const [start,end]=adminMonthRange(month);
  const [rows,settings]=await Promise.all([adminRows('orders',q=>q.gte('paid_at',start).lt('paid_at',end).order('paid_at').order('id')),adminRows('settings',q=>q.order('key'))]);
  if(version!==reportVersion) return;
  const totals=adminReportTotals(rows,settings);reportRows=rows;reportMonth=month;
  document.getElementById('report-stats').replaceChildren(stat('Pedidos pagos no mês',totals.count),stat('Receita bruta',adminMoney(totals.cents),1),stat('Comissão',adminMoney(totals.commissionCents),2));
  orderTable(rows,document.getElementById('report-table'),null,true);exportButton.disabled=false;
  announce('Comissão de '+totals.percent+'%, limitada a '+adminMoney(Math.round(totals.cap*100))+' por mês.');
 }
 async function runRefresh() {
  retry.hidden=true;announce('Carregando os dados.');
  try {
   if(!await hasAdminAccess()) {view.hidden=true;window.location.replace('/admin/entrar/');return;}
   await refresh();if(page!=='Relatório') announce('Dados atualizados.');
  }
  catch {announce(ADMIN_FAILURE,true);retry.hidden=false;}
 }
 function updateSheet() {
  const detail=document.getElementById('order-detail');if(!detail) return;
  const modal=!detail.hidden&&matchMedia('(max-width:1279px)').matches;
  if(modal) {detail.setAttribute('role','dialog');detail.setAttribute('aria-modal','true');}
  else {detail.removeAttribute('role');detail.removeAttribute('aria-modal');}
  document.querySelectorAll('.admin-sidebar,.admin-topbar,.admin-filters,#orders-table,#admin-main>h1,#admin-feedback,#admin-retry').forEach(element=>{element.inert=modal;});
 }
 try {
  const session=await requireAdmin();if(!session) return;
  // Nothing inside the private view is revealed until the database approves membership.
  document.body.style.visibility='visible';view.hidden=false;
  const profile=await adminRequest(client=>client.from('profiles').select('full_name').eq('user_id',session.user.id).maybeSingle());
  document.getElementById('admin-name').textContent=profile.data?.full_name||'—';
  const sidebar=document.getElementById('admin-sidebar'),toggle=document.getElementById('sidebar-toggle');
  function closeSidebar() {sidebar.dataset.open='false';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Abrir navegação');}
  toggle.addEventListener('click',()=>{const open=sidebar.dataset.open!=='true';sidebar.dataset.open=String(open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Fechar navegação':'Abrir navegação');});
  document.addEventListener('click',event=>{if(!sidebar.contains(event.target)&&!toggle.contains(event.target)) closeSidebar();});
  document.addEventListener('keydown',event=>{
   if(document.getElementById('admin-confirm').open) return;
   const detail=document.getElementById('order-detail');
   if(event.key==='Tab'&&detail?.getAttribute('aria-modal')==='true') {
    const controls=[...detail.querySelectorAll('a[href],button:not(:disabled),select')],first=controls[0],last=controls.at(-1);
    if(controls.length&&((event.shiftKey&&document.activeElement===first)||(!event.shiftKey&&document.activeElement===last))) {event.preventDefault();(event.shiftKey?last:first).focus();}
   }
   if(event.key==='Escape') {if(detail&&!detail.hidden) closeDetail();if(sidebar.dataset.open==='true') {closeSidebar();toggle.focus();}}
  });
  matchMedia('(max-width:1279px)').addEventListener('change',updateSheet);
  matchMedia('(min-width:900px)').addEventListener('change',closeSidebar);
  document.getElementById('admin-sign-out').addEventListener('click',event=>perform(event.currentTarget,()=>signOut()));
  window.addEventListener('taplocal-auth-change',event=>{if(!event.detail?.authenticated) window.location.replace('/admin/entrar/');});
  if(page==='Painel') refresh=dashboard;
  if(page==='Pedidos') {
   Object.entries(ADMIN_STATUSES).forEach(([value,label])=>document.getElementById('status-filter').append(new Option(label,value)));
   Object.entries(ADMIN_PRODUCTS).forEach(([value,label])=>document.getElementById('product-filter').append(new Option(label,value)));
   selectedId=new URLSearchParams(window.location.search).get('id');
   if(selectedId&&!/^[0-9a-f-]{36}$/i.test(selectedId)) selectedId=null;
   ['status-filter','product-filter'].forEach(id=>document.getElementById(id).addEventListener('change',runRefresh));
   let timer;document.getElementById('company-search').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(runRefresh,250);});refresh=loadOrders;
  }
  if(page==='Placas') refresh=pendingPlates;
  if(page==='Solicitações') refresh=deletionRequests;
  if(page==='Relatório') {
   document.getElementById('report-month').value=adminCurrentMonth();document.getElementById('report-month').addEventListener('change',()=>{document.getElementById('export-csv').disabled=true;runRefresh();});refresh=report;
   document.getElementById('export-csv').addEventListener('click',()=>{
    const blob=new Blob([adminCsv(reportRows)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=node('a');
    link.href=url;link.download='taplocal-relatorio-'+reportMonth+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
   });
  }
  retry.addEventListener('click',runRefresh);await runRefresh();
 } catch {
  // A failed access check exposes only an error, never the private data view.
  view.hidden=true;document.querySelector('.admin-sidebar').hidden=true;document.querySelector('.admin-topbar').hidden=true;
  document.querySelector('.admin-workspace').style.marginLeft='0';document.body.style.visibility='visible';announce('Não foi possível verificar o acesso. Recarregue a página.',true);
 }
})();
