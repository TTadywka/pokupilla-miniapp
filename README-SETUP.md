# Покупилла — полное подключение Telegram Mini App + бота

## Что внутри
- `index.html`, `styles.css`, `app.js`, `catalog.js` — витрина.
- `data/source.html` — исходный прайс.
- `data/catalog.json` — разобранный каталог.
- `server.js` — HTTPS-ready веб-сервер + Telegram Bot API polling + обработка заявок.
- `.env.example` — переменные окружения.
- `Dockerfile` — запуск в Docker/на хостинге.

## 1. Создать бота
В Telegram открой `@BotFather` → `/newbot` → задай имя и username.
BotFather выдаст BOT TOKEN. Никому его не отправляй и не публикуй в GitHub.

## 2. Подготовить хостинг
Нужен публичный HTTPS-адрес. Удобный вариант для этого проекта — Render Web Service.

После создания сервиса добавь переменные:
- `BOT_TOKEN` = токен от BotFather
- `WEBAPP_URL` = публичный HTTPS URL сервиса
- `ADMIN_CHAT_ID` = Telegram ID менеджера/чата, куда приходят заявки

Build command: `npm install`
Start command: `npm start`

После деплоя проверь:
`https://YOUR-DOMAIN/health`

Должно вернуть JSON с `ok:true` и `webappConfigured:true`.

## 3. Получить ADMIN_CHAT_ID
Самый простой способ: напиши своему боту `/start`, а затем временно посмотри update через Bot API или используй отдельный ID-бот.
Не публикуй свой ID вместе с токеном.

## 4. Настройка BotFather
После того как HTTPS URL уже работает:
- `/mybots` → твой бот → Bot Settings → Configure Mini App → Enable Mini App.
- Укажи `WEBAPP_URL`.
- В Menu Button поставь кнопку `Каталог` с тем же URL (сервер делает это сам при старте, но это можно проверить в BotFather).
- При желании настрой Main Mini App, Splash Screen, аватар и описание.

Telegram официально поддерживает Main Mini App, Menu Button и запуск Mini App из кнопки. Тема Telegram передаётся в WebApp, а `initData` нужно валидировать на сервере перед доверием данным пользователя.

## 5. Как работает заявка
1. Пользователь открывает каталог.
2. Нажимает товар → «Уточнить наличие».
3. Mini App отправляет `initData` + товар на `/api/product-request`.
4. Сервер проверяет подпись Telegram `initData`.
5. Заявка записывается в `data/requests.jsonl`.
6. Менеджеру приходит сообщение в Telegram.
7. Пользователю приходит подтверждение.

## 6. Локальный запуск
Windows PowerShell:
```powershell
$env:BOT_TOKEN="..."
$env:WEBAPP_URL="http://localhost:3000"
$env:ADMIN_CHAT_ID="..."
npm start
```
Для обычного Telegram Mini App в production нужен HTTPS.

## 7. Обновление прайса
Заменить `data/source.html`, затем:
```bash
python tools/parse_prices.py data/source.html data/catalog.json
```
После этого обновить `catalog.js` из JSON и заново задеплоить.

## Важно
Исходный прайс содержит название и цену, а часть характеристик закодирована прямо в названии. В нём нет полного набора характеристик вроде камер, процессора и экрана, поэтому такие параметры нельзя честно добавить из этого файла без отдельного источника данных.
