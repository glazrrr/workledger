const $=id=>document.getElementById(id);
const load=k=>JSON.parse(localStorage.getItem(k)||'[]');
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
let clients=load('wl_clients'),entries=load('wl_entries'),lastSummary=[];
const today=new Date().toISOString().slice(0,10);
$('date').value=today;
$('periodFrom').value=today.slice(0,8)+'01';
$('periodTo').value=today;

function hours(e){
  let a=e.from.split(':').reduce((h,m)=>h*60+ +m,0);
  let b=e.to.split(':').reduce((h,m)=>h*60+ +m,0);
  if(b<a)b+=1440;
  return Math.max(0,(b-a-(+e.pause||0))/60);
}
function esc(s){
  return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function render(){
  $('clientSelect').innerHTML=clients.map((c,i)=>`<option value="${i}">${esc(c.name)} — ${c.rate} Kč/h</option>`).join('');
  $('clientList').innerHTML=clients.map((c,i)=>`<div class="item"><b>${esc(c.name)}</b><div class="muted">${c.rate} Kč / hod.</div><button onclick="removeClient(${i})">Smazat</button></div>`).join('');
  $('entries').innerHTML=entries.map((e,i)=>({e,i})).reverse().slice(0,50).map(({e,i})=>`
    <div class="item">
      <b>${esc(e.client)}</b>
      <div class="muted">${esc(e.date)} · ${esc(e.from)}–${esc(e.to)} · pauza ${Number(e.pause)||0} min</div>
      <div>${esc(e.note||'')}</div>
      <div class="amount">${hours(e).toFixed(2)} h · ${(hours(e)*e.rate).toFixed(0)} Kč</div>
      <div class="entry-actions"><button type="button" onclick="editEntry(${i})">Upravit</button> <button type="button" onclick="deleteEntry(${i})">Smazat</button></div>
    </div>`).join('')||'<p class="muted">Zatím žádné záznamy.</p>';
}
$('clientForm').onsubmit=e=>{
  e.preventDefault();
  clients.push({name:$('clientName').value.trim(),rate:+$('rate').value});
  save('wl_clients',clients);e.target.reset();render();
};
$('workForm').onsubmit=e=>{
  e.preventDefault();
  let c=clients[+$('clientSelect').value];
  if(!c){alert('Nejprve přidej odběratele.');return;}
  entries.push({date:$('date').value,client:c.name,rate:c.rate,from:$('from').value,to:$('to').value,pause:+$('break').value,note:$('note').value});
  save('wl_entries',entries);$('note').value='';render();
};
window.removeClient=i=>{
  if(confirm('Opravdu smazat odběratele? Již uložené pracovní záznamy zůstanou zachované.')){
    clients.splice(i,1);save('wl_clients',clients);render();
  }
};
window.deleteEntry=i=>{
  if(!entries[i])return;
  if(confirm(`Opravdu smazat záznam ze dne ${entries[i].date} – ${entries[i].client}?`)){
    entries.splice(i,1);save('wl_entries',entries);render();
  }
};
window.editEntry=i=>{
  const e=entries[i];if(!e)return;
  const date=prompt('Datum (RRRR-MM-DD):',e.date);if(date===null)return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){alert('Neplatný formát data. Použij RRRR-MM-DD.');return;}
  let clientText='Vyber odběratele zadáním čísla:\n'+clients.map((c,n)=>`${n+1}. ${c.name} (${c.rate} Kč/h)`).join('\n');
  let current=clients.findIndex(c=>c.name===e.client);
  let clientChoice=prompt(clientText, current>=0?String(current+1):'');if(clientChoice===null)return;
  let ci=Number(clientChoice)-1;if(!Number.isInteger(ci)||ci<0||ci>=clients.length){alert('Neplatná volba odběratele.');return;}
  const from=prompt('Čas OD (HH:MM):',e.from);if(from===null)return;
  const to=prompt('Čas DO (HH:MM):',e.to);if(to===null)return;
  const pause=prompt('Přestávka v minutách:',String(e.pause??0));if(pause===null)return;
  const note=prompt('Popis práce:',e.note||'');if(note===null)return;
  const timeOK=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  if(!timeOK(from)||!timeOK(to)){alert('Čas musí být ve formátu HH:MM.');return;}
  if(!Number.isFinite(Number(pause))||Number(pause)<0){alert('Přestávka musí být nezáporné číslo.');return;}
  const c=clients[ci];
  entries[i]={...e,date,client:c.name,rate:c.rate,from,to,pause:Number(pause),note};
  save('wl_entries',entries);render();
};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('nav button,.tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');$(b.dataset.tab).classList.add('active');
});
$('calculate').onclick=()=>{
  let a=$('periodFrom').value,b=$('periodTo').value,map={};
  entries.filter(e=>e.date>=a&&e.date<=b).forEach(e=>{
    let x=map[e.client]||(map[e.client]={hours:0,total:0});
    x.hours+=hours(e);x.total+=hours(e)*e.rate;
  });
  lastSummary=Object.entries(map).map(([client,v])=>({client,...v}));
  $('summary').innerHTML=lastSummary.map(x=>`<div class="item"><b>${esc(x.client)}</b><div>${x.hours.toFixed(2)} hodin</div><div class="amount">${x.total.toFixed(0)} Kč</div></div>`).join('')||'<p class="muted">V tomto období nejsou žádné záznamy.</p>';
  let total=lastSummary.reduce((s,x)=>s+x.total,0);
  $('summary').innerHTML+=`<h2>Celkem: ${total.toFixed(0)} Kč</h2>`;
};
$('csv').onclick=()=>{
  let rows=[['Odběratel','Hodiny','Částka Kč'],...lastSummary.map(x=>[x.client,x.hours.toFixed(2),x.total.toFixed(0)])];
  download('workledger-prehled.csv','\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';')).join('\n'),'text/csv');
};
$('backup').onclick=()=>download('workledger-zaloha.json',JSON.stringify({clients,entries},null,2),'application/json');
$('restore').onchange=async e=>{
  try{let d=JSON.parse(await e.target.files[0].text());clients=d.clients||[];entries=d.entries||[];save('wl_clients',clients);save('wl_entries',entries);render();alert('Záloha obnovena.');}
  catch{alert('Soubor zálohy není platný.');}
};
function download(name,data,type){let a=document.createElement('a'),u=URL.createObjectURL(new Blob([data],{type}));a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);}
render();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
