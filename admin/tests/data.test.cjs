const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function context(overrides={}) {
 const target={window:{},setTimeout,clearTimeout,URL,Intl,Date,...overrides};
 vm.createContext(target);vm.runInContext(fs.readFileSync(path.join(__dirname,'../data.js'),'utf8'),target);return target;
}
const settings=[{key:'commission_percent',value:15},{key:'commission_cap',value:800},{key:'cycle',text_value:'monthly'}];
test('report uses stored cents, rounds currency, and caps the monthly commission',()=>{
 const ctx=context();
 assert.equal(ctx.adminReportTotals([{price_cents:9990},{price_cents:17990}],settings).cents,27980);
 assert.equal(ctx.adminReportTotals([{price_cents:9990},{price_cents:17990}],settings).commissionCents,4197);
 assert.equal(ctx.adminReportTotals([{price_cents:1000000}],settings).commissionCents,80000);
 assert.equal(ctx.adminReportTotals([],settings).commissionCents,0);
});
test('missing settings, unsupported cycles and invalid price snapshots fail closed',()=>{
 const ctx=context();
 assert.throws(()=>ctx.adminReportTotals([],[]));
 assert.throws(()=>ctx.adminReportTotals([],[...settings.slice(0,2),{key:'cycle',text_value:'weekly'}]));
 for(const price_cents of [null,-1,1.5,Number.MAX_SAFE_INTEGER+1]) assert.throws(()=>ctx.adminReportTotals([{price_cents}],settings));
});
test('month boundaries use the business timezone and roll December into January',()=>{
 const ctx=context();
 assert.equal(JSON.stringify(ctx.adminMonthRange('2026-12')),JSON.stringify(['2026-12-01T00:00:00-03:00','2027-01-01T00:00:00-03:00']));
 for(const month of ['', '2026-13','2026-00','2026-1','not-a-month']) assert.throws(()=>ctx.adminMonthRange(month));
});
test('CSV exports the displayed records and neutralizes customer spreadsheet formulas',()=>{
 const ctx=context();
 const csv=ctx.adminCsv([{id:'order',company_name:'=1+1',product:'duo',status:'pago',paid_at:'2026-10-13T12:00:00Z',price_cents:17990}]);
 assert.ok(csv.startsWith('\uFEFF'));
 assert.ok(csv.includes('"\'=1+1"'));
 assert.ok(csv.includes('"Duo";"Pago";"13/10/2026";"179,90"'));
 assert.equal(csv.split('\r\n').length,2);
});
test('logged-out access redirects before querying admin membership',async()=>{
 let queries=0,redirect;
 const ctx=context({getSession:async()=>null,window:{location:{replace:value=>{redirect=value;}},taplocalSupabase:{rpc:()=>{queries++;}}}});
 assert.equal(await ctx.requireAdmin(),null);assert.equal(queries,0);assert.equal(redirect,'/admin/entrar/');
});
test('a session without database membership cannot pass the gate',async()=>{
 let redirect;
 const ctx=context({getSession:async()=>({}),window:{location:{replace:value=>{redirect=value;}},taplocalSupabase:{rpc:async()=>({data:false,error:null})}}});
 assert.equal(await ctx.requireAdmin(),null);assert.equal(redirect,'/admin/entrar/');
});
test('API errors never expose the server response',async()=>{
 const ctx=context({window:{taplocalSupabase:{rpc:async()=>({error:{message:'internal confidential details'}})}}});
 await assert.rejects(ctx.hasAdminAccess(),/Não foi possível carregar ou salvar os dados/);
});
test('pagination includes records beyond the first API page',async()=>{
 const ranges=[];
 const client={from:()=>({select:()=>({range:async(start,end)=>{ranges.push([start,end]);return {data:Array.from({length:start===0?1000:1},()=>({})),error:null};}})})};
 const ctx=context({window:{taplocalSupabase:client}});
 assert.equal((await ctx.adminRows('orders')).length,1001);
 assert.deepEqual(ranges,[[0,999],[1000,1999]]);
});
test('configuration confirmation compares both pending state and the reviewed URL',async()=>{
 const filters=[];
 const query={eq:(key,value)=>{filters.push([key,value]);return query;},select:()=>query,single:async()=>({data:{id:'plate'},error:null})};
 const ctx=context({window:{taplocalSupabase:{from:()=>({update:()=>query})}}});
 await ctx.adminUpdate('plates','plate',{status:'configurada'},'status','aguardando_configuracao','https://g.page/example');
 assert.deepEqual(filters,[['id','plate'],['status','aguardando_configuracao'],['configured_url','https://g.page/example']]);
});
