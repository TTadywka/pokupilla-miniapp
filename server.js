const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '';
const WEBAPP_URL = process.env.WEBAPP_URL || '';
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.jsonl');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data);
}

function sendText(res, status, text, type='text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(text);
}

function safePath(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  if (decoded === '/') decoded = '/index.html';
  const file = path.normalize(path.join(ROOT, decoded));
  if (!file.startsWith(ROOT)) return null;
  return file;
}

const mime = {
  '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.webp':'image/webp', '.ico':'image/x-icon'
};

async function telegram(method, payload={}) {
  if (!BOT_TOKEN) throw new Error('BOT_TOKEN is not configured');
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload)
  });
  const data = await r.json();
  if (!data.ok) throw new Error(data.description || `Telegram API ${method} failed`);
  return data.result;
}

async function sendMessage(chatId, text, reply_markup) {
  return telegram('sendMessage', { chat_id: chatId, text, parse_mode:'HTML', reply_markup });
}

function mainKeyboard() {
  return { inline_keyboard: [[{ text:'🛍 Открыть каталог', web_app:{ url:WEBAPP_URL } }]] };
}

async function configureBot() {
  if (!BOT_TOKEN || !WEBAPP_URL) return;
  await telegram('setMyCommands', { commands:[
    {command:'start', description:'Открыть каталог'},
    {command:'catalog', description:'Открыть каталог'},
    {command:'help', description:'Помощь'}
  ]});
  await telegram('setChatMenuButton', { menu_button:{ type:'web_app', text:'Каталог', web_app:{ url:WEBAPP_URL } } });
  console.log('Telegram bot configured:', WEBAPP_URL);
}

function validateInitData(initData) {
  if (!BOT_TOKEN) return { ok:false, reason:'server_not_configured' };
  const params = new URLSearchParams(initData || '');
  const hash = params.get('hash');
  if (!hash) return { ok:false, reason:'missing_hash' };
  params.delete('hash');
  const dataCheckString = [...params.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const expected = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expected, 'hex'))) return { ok:false, reason:'bad_hash' };
  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Math.abs(Date.now()/1000 - authDate) > 86400) return { ok:false, reason:'expired' };
  let user = null;
  try { user = JSON.parse(params.get('user') || 'null'); } catch {}
  return { ok:true, user };
}

function appendRequest(request) {
  fs.appendFileSync(REQUESTS_FILE, JSON.stringify(request) + '\n', 'utf8');
}

async function handleProductRequest(req, res, body) {
  let payload;
  try { payload = JSON.parse(body || '{}'); } catch { return json(res,400,{ok:false,error:'invalid_json'}); }
  const auth = validateInitData(payload.initData);
  if (!auth.ok) return json(res,401,{ok:false,error:`init_data_${auth.reason}`});
  if (payload.action !== 'product_request') return json(res,400,{ok:false,error:'unknown_action'});

  const request = {
    created_at: new Date().toISOString(),
    user: auth.user || null,
    product_id: payload.product_id || null,
    name: String(payload.name || '').slice(0,300),
    price: Number(payload.price || 0)
  };
  appendRequest(request);

  const u = request.user;
  const customer = u ? [u.first_name,u.last_name].filter(Boolean).join(' ') : 'Пользователь Telegram';
  const username = u?.username ? `@${u.username}` : 'без username';
  const adminText = `🛒 <b>Новый запрос из каталога</b>\n\n<b>Товар:</b> ${escapeHtml(request.name)}\n<b>Цена:</b> ${new Intl.NumberFormat('ru-RU').format(request.price)} ₽\n<b>Клиент:</b> ${escapeHtml(customer)}\n<b>Username:</b> ${escapeHtml(username)}\n<b>ID:</b> <code>${escapeHtml(String(u?.id || '—'))}</code>`;
  if (ADMIN_CHAT_ID) {
    try { await sendMessage(ADMIN_CHAT_ID, adminText); } catch (e) { console.error('Admin notify failed:', e.message); }
  }
  if (u?.id) {
    try { await sendMessage(u.id, `Спасибо! Запрос по товару <b>${escapeHtml(request.name)}</b> принят. Мы уточним наличие.`, { inline_keyboard:[[ {text:'🛍 Вернуться в каталог', web_app:{url:WEBAPP_URL}} ]] }); } catch (e) { console.error('Customer notify failed:', e.message); }
  }
  return json(res,200,{ok:true});
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function handleUpdate(update) {
  const m = update.message;
  if (!m?.chat?.id) return;
  const text = m.text || '';
  if (/^\/(start|catalog)(?:\s|$)/.test(text)) {
    await sendMessage(m.chat.id, `👋 <b>Добро пожаловать в «Покупилла»!</b>\n\nОткройте каталог смартфонов и техники, выберите модель и нажмите «Уточнить наличие».`, mainKeyboard());
  } else if (/^\/help/.test(text)) {
    await sendMessage(m.chat.id, `Выберите товар в каталоге. Если нужной модели нет — напишите нам в чате.`, mainKeyboard());
  }
}

let offset = 0;
async function pollingLoop() {
  if (!BOT_TOKEN) return;
  while (true) {
    try {
      const updates = await telegram('webhook', { timeout:25, offset, allowed_updates:['message'] });
      for (const update of updates) {
        offset = update.update_id + 1;
        try { await handleUpdate(update); } catch (e) { console.error('Update failed:', e.message); }
      }
    } catch (e) {
      console.error('Polling error:', e.message);
      await new Promise(r=>setTimeout(r,3000));
    }
  }
}

const server = http.createServer(async (req,res)=>{
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') return json(res,200,{ok:true,telegramConfigured:Boolean(BOT_TOKEN),webappConfigured:Boolean(WEBAPP_URL)});
  if (req.method === 'POST' && url.pathname === '/api/product-request') {
    let body=''; req.on('data',chunk=>{body+=chunk; if(body.length>100000){req.destroy();}}); req.on('end',()=>handleProductRequest(req,res,body).catch(e=>{console.error(e);json(res,500,{ok:false,error:'server_error'});})); return;
  }
  if (req.method !== 'GET') return sendText(res,405,'Method Not Allowed');
  const file = safePath(url.pathname);
  if (!file) return sendText(res,403,'Forbidden');
  fs.stat(file,(err,st)=>{
    if(err || !st.isFile()) return sendText(res,404,'Not found');
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':path.extname(file)==='.html'?'no-cache':'public, max-age=3600'});
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, async ()=>{
  console.log(`Server listening on :${PORT}`);
  try { await configureBot(); } catch(e) { console.error('Bot configuration failed:',e.message); }
  pollingLoop();
});
