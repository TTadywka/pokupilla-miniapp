const tg = window.Telegram?.WebApp;
const PRODUCTS = window.PRODUCTS || [];

const $ = id => document.getElementById(id);
const state = { search:'', brand:'', category:'', minPrice:'', maxPrice:'', ram:'', storage:'', condition:'', esim:false, sort:'default' };

function initTelegram(){
  if(!tg) return;
  tg.ready(); tg.expand();
  tg.setHeaderColor?.('secondary_bg_color');
  tg.setBackgroundColor?.('bg_color');
  tg.onEvent?.('themeChanged', render);
}
function money(n){return new Intl.NumberFormat('ru-RU').format(n)+' ₽'}
function categoryName(v){return {smartphone:'Смартфон',tablet:'Планшет',watch:'Часы'}[v]||v}
function conditionName(v){return v==='used'?'Б/у':'Новое'}
function normalize(s){return String(s||'').toLowerCase().replaceAll('ё','е')}
function options(){
  const uniq = key => [...new Set(PRODUCTS.map(p=>p[key]).filter(v=>v!==null&&v!==undefined&&v!==''))].sort((a,b)=>String(a).localeCompare(String(b),'ru',{numeric:true}));
  for(const v of uniq('brand')) $('brandFilter').insertAdjacentHTML('beforeend',`<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`);
  for(const v of uniq('ram')) $('ramFilter').insertAdjacentHTML('beforeend',`<option value="${v}">${v} ГБ</option>`);
  for(const v of uniq('storage')) $('storageFilter').insertAdjacentHTML('beforeend',`<option value="${v}">${v} ГБ</option>`);
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function escapeAttr(s){return escapeHtml(s)}
function filtered(){
 let arr=PRODUCTS.filter(p=>{
   const q=normalize(state.search);
   return (!q||normalize(p.name).includes(q)) && (!state.brand||p.brand===state.brand) && (!state.category||p.category===state.category) && (!state.minPrice||p.price>=Number(state.minPrice)) && (!state.maxPrice||p.price<=Number(state.maxPrice)) && (!state.ram||String(p.ram)===String(state.ram)) && (!state.storage||String(p.storage)===String(state.storage)) && (!state.condition||p.condition===state.condition) && (!state.esim||p.esim);
 });
 if(state.sort==='priceAsc') arr.sort((a,b)=>a.price-b.price); else if(state.sort==='priceDesc') arr.sort((a,b)=>b.price-a.price); else if(state.sort==='name') arr.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
 return arr;
}
function renderChips(){
 const chips=[]; if(state.brand) chips.push(['brand',state.brand]); if(state.category) chips.push(['category',categoryName(state.category)]); if(state.ram) chips.push(['ram',state.ram+' ГБ RAM']); if(state.storage) chips.push(['storage',state.storage+' ГБ']); if(state.condition) chips.push(['condition',conditionName(state.condition)]); if(state.esim) chips.push(['esim','eSIM']);
 $('chips').innerHTML=chips.map(([k,v])=>`<button class="chip active" data-chip="${k}">${escapeHtml(v)} ×</button>`).join('');
 document.querySelectorAll('[data-chip]').forEach(b=>b.onclick=()=>{state[b.dataset.chip]=b.dataset.chip==='esim'?false:''; syncFilters(); render()});
}
function card(p){
 const tag=p.condition==='used'?'Б/У':(p.esim?'eSIM':'');
 const meta=[p.ram?`${p.ram} ГБ RAM`:null,p.storage?`${p.storage} ГБ`:null,p.esim?'eSIM':null].filter(Boolean).join(' · ');
 return `<article class="product-card" data-id="${p.id}"><div class="phone-art">${tag?`<span class="tag">${escapeHtml(tag)}</span>`:''}<div class="phone"></div></div><div class="card-body"><div class="card-title">${escapeHtml(p.title)}</div><div class="meta">${escapeHtml(meta||categoryName(p.category))}</div><div class="price">${money(p.price)}</div></div></article>`;
}
function render(){
 const arr=filtered(); $('resultCount').textContent=`${arr.length} ${arr.length===1?'товар':arr.length<5?'товара':'товаров'}`; $('products').innerHTML=arr.map(card).join(''); $('empty').hidden=arr.length>0; renderChips();
 document.querySelectorAll('.product-card').forEach(c=>c.onclick=()=>openProduct(Number(c.dataset.id)));
 $('clearSearch').hidden=!state.search;
 if(tg) tg.setHeaderColor?.('secondary_bg_color');
}
function syncFilters(){ $('brandFilter').value=state.brand; $('categoryFilter').value=state.category; $('minPrice').value=state.minPrice; $('maxPrice').value=state.maxPrice; $('ramFilter').value=state.ram; $('storageFilter').value=state.storage; $('conditionFilter').value=state.condition; $('esimFilter').checked=state.esim; $('sort').value=state.sort }
function readFilters(){ state.brand=$('brandFilter').value; state.category=$('categoryFilter').value; state.minPrice=$('minPrice').value; state.maxPrice=$('maxPrice').value; state.ram=$('ramFilter').value; state.storage=$('storageFilter').value; state.condition=$('conditionFilter').value; state.esim=$('esimFilter').checked; }
function reset(){Object.assign(state,{search:'',brand:'',category:'',minPrice:'',maxPrice:'',ram:'',storage:'',condition:'',esim:false,sort:'default'}); $('search').value=''; syncFilters(); render();}
function openFilters(){$('filterSheet').hidden=false}
function closeFilters(){$('filterSheet').hidden=true}
function openProduct(id){const p=PRODUCTS.find(x=>x.id===id); if(!p)return; $('modalContent').innerHTML=`<div class="detail-art"><div class="phone"></div></div><h2 class="detail-title">${escapeHtml(p.name)}</h2><div class="detail-price">${money(p.price)}</div><div class="specs"><div class="spec"><small>Бренд</small><strong>${escapeHtml(p.brand)}</strong></div><div class="spec"><small>Категория</small><strong>${categoryName(p.category)}</strong></div><div class="spec"><small>Память</small><strong>${p.storage?p.storage+' ГБ':'—'}</strong></div><div class="spec"><small>RAM</small><strong>${p.ram?p.ram+' ГБ':'—'}</strong></div><div class="spec"><small>Состояние</small><strong>${conditionName(p.condition)}</strong></div><div class="spec"><small>SIM</small><strong>${p.esim?'eSIM':'—'}</strong></div></div><div class="detail-actions"><button class="secondary-btn" id="shareProduct">Поделиться</button><button class="primary-btn" id="orderProduct">Уточнить наличие</button></div>`; $('productModal').hidden=false; if(tg) tg.BackButton?.show(); $('orderProduct').onclick=()=>sendOrder(p); $('shareProduct').onclick=()=>shareProduct(p)}
function closeProduct(){ $('productModal').hidden=true; if(tg) tg.BackButton?.hide() }
async function sendOrder(p){ const payload={action:'product_request',product_id:p.id,name:p.name,price:p.price,initData:tg?.initData||''}; try { const r=await fetch('/api/product-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const data=await r.json(); if(!r.ok||!data.ok) throw new Error(data.error||'request_failed'); alert('Запрос отправлен!'); } catch(e) { console.error(e); alert('Не удалось отправить запрос. Проверьте соединение.'); } }
function shareProduct(p){ const text=encodeURIComponent(`ПОКУПИЛЛА — ${p.name}\n${money(p.price)}`); if(tg?.openTelegramLink){ tg.openTelegramLink(`https://t.me/share/url?url=&text=${text}`) } else if(navigator.share){navigator.share({title:p.name,text:decodeURIComponent(text)})} }

$('search').addEventListener('input',e=>{state.search=e.target.value;render()}); $('clearSearch').onclick=()=>{$('search').value='';state.search='';render()}; $('sort').onchange=e=>{state.sort=e.target.value;render()}; $('filterOpen').onclick=openFilters; $('filterClose').onclick=closeFilters; $('applyFilters').onclick=()=>{readFilters();closeFilters();render()}; $('resetFilters').onclick=()=>{reset();closeFilters()}; $('resetEmpty').onclick=reset; $('modalClose').onclick=closeProduct; $('productModal').onclick=e=>{if(e.target===$('productModal'))closeProduct()};
if(tg) tg.onEvent?.('backButtonClicked',closeProduct);
options(); syncFilters(); initTelegram(); render();
