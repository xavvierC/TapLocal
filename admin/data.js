/* All operations use the shared client and the caller's JWT. RLS is authoritative. */
const ADMIN_FAILURE = 'Não foi possível carregar ou salvar os dados. Tente novamente.';
const ADMIN_STATUSES = Object.freeze({aguardando_pagamento:'Aguardando pagamento',pago:'Pago',em_producao:'Em produção',enviado:'Enviado',entregue:'Entregue',cancelado:'Cancelado'});
const ADMIN_PRODUCTS = Object.freeze({'individual-google':'Individual · Google','individual-instagram':'Individual · Instagram',duo:'Duo',kit:'Kit Negócio'});
const ADMIN_TRANSITIONS = Object.freeze({aguardando_pagamento:['pago','cancelado'],pago:['em_producao'],em_producao:['enviado'],enviado:['entregue'],entregue:[],cancelado:[]});
async function adminRequest(request) {
 let timer;
 try {
  if (!window.taplocalSupabase) throw new Error();
  const result=await Promise.race([request(window.taplocalSupabase),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error()),30000);})]);
  if (result.error) throw new Error();
  return result;
 } catch { throw new Error(ADMIN_FAILURE); }
 finally { clearTimeout(timer); }
}
async function hasAdminAccess() { return (await adminRequest(client=>client.rpc('is_admin'))).data===true; }
async function requireAdmin() {
 const session=await getSession();
 if (!session) { window.location.replace('/admin/entrar/'); return null; }
 if (!await hasAdminAccess()) { window.location.replace('/admin/entrar/'); return null; }
 return session;
}
async function adminRows(table, configure=query=>query) {
 const rows=[];
 // Fetch every page: reports and CSV must not silently stop at the API's 1,000-row limit.
 for (let start=0;;start+=1000) {
  const {data}=await adminRequest(client=>configure(client.from(table).select('*')).range(start,start+999));
  rows.push(...data);
  if(data.length<1000) return rows;
 }
}
async function adminCount(table,configure=query=>query) {
 const count=(await adminRequest(client=>configure(client.from(table).select('id',{count:'exact',head:true})))).count;
 if(!Number.isSafeInteger(count)||count<0) throw new Error(ADMIN_FAILURE);
 return count;
}
async function adminUpdate(table,id,values,expectedColumn,expectedValue,reviewedUrl) {
 // Compare-and-set prevents stale dialogs from overwriting another admin's change.
 return (await adminRequest(client=>{
  let query=client.from(table).update(values).eq('id',id).eq(expectedColumn,expectedValue);
  if(reviewedUrl!==undefined) query=query.eq('configured_url',reviewedUrl);
  return query.select('id').single();
 })).data;
}
function adminMonthRange(value) {
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error(ADMIN_FAILURE);
 const [year,month]=value.split('-').map(Number);
 if(year<2020||year>9998) throw new Error(ADMIN_FAILURE);
 const next=new Date(Date.UTC(year,month,1));
 // Business reporting uses America/Sao_Paulo (UTC-03 since 2019).
 return [value+'-01T00:00:00-03:00',next.toISOString().slice(0,10)+'T00:00:00-03:00'];
}
function adminCurrentMonth() {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(new Date());
 return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;
}
function adminReportTotals(rows,settings) {
 const values=Object.fromEntries(settings.map(row=>[row.key,row]));
 const percent=Number(values.commission_percent?.value),cap=Number(values.commission_cap?.value);
 if(values.cycle?.text_value!=='monthly'||!Number.isFinite(percent)||percent<0||percent>100||!Number.isFinite(cap)||cap<0) throw new Error(ADMIN_FAILURE);
 const cents=rows.reduce((sum,row)=>{
  if(!Number.isSafeInteger(row.price_cents)||row.price_cents<0) throw new Error(ADMIN_FAILURE);
  return sum+row.price_cents;
 },0);
 if(!Number.isSafeInteger(cents)) throw new Error(ADMIN_FAILURE);
 return {count:rows.length,cents,commissionCents:Math.min(Math.round(cents*percent/100),Math.round(cap*100)),percent,cap};
}
function adminDate(value) { return value?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'}).format(new Date(value)):'—'; }
function adminMoney(cents) { return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100); }
function adminCsv(rows) {
 const cell=value=>{
  let text=String(value??'');
  // Prevent spreadsheet formula injection from customer-controlled company names.
  if(/^[\s]*[=+\-@]/.test(text)) text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
 };
 const lines=[['Pedido','Empresa','Produto','Status','Pagamento','Valor'],...rows.map(row=>[row.id,row.company_name,ADMIN_PRODUCTS[row.product],ADMIN_STATUSES[row.status],adminDate(row.paid_at),(row.price_cents/100).toFixed(2).replace('.',',')])];
 return '\uFEFF'+lines.map(line=>line.map(cell).join(';')).join('\r\n');
}
