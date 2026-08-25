// Приём ответов админа прямо из Telegram: лонг-поллинг Bot API в этом же процессе backend'а
// (отдельный сервис не нужен — меньше мест, где что-то может сломаться при деплое).
// Админ отвечает (Reply) в Telegram на пересланное сообщение курьера — бот вытаскивает
// id курьера из текста оригинального сообщения и записывает ответ в чат напрямую в БД,
// той же логикой, что и обычный ответ из веб-панели.

import { db } from "../db/client";
import { chatMessages, notifications } from "../db/schema";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;

let offset = 0;
let running = false;

function extractCourierId(text: string | undefined | null): string | null {
  if (!text) return null;
  const m = text.match(/\(id:\s*([a-f0-9-]{8,36})\)/i);
  return m ? m[1] : null;
}

async function sendMessage(text: string, replyTo?: number) {
  if (!API || !ADMIN_CHAT_ID) return;
  try {
    await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text,
        ...(replyTo ? { reply_to_message_id: replyTo } : {}),
      }),
    });
  } catch (err) {
    console.error("[telegram-bot] не удалось отправить сообщение", err);
  }
}

async function handleUpdate(update: any) {
  const msg = update.message;
  if (!msg) return;
  const chatId = String(msg.chat?.id ?? "");
  if (!ADMIN_CHAT_ID || chatId !== String(ADMIN_CHAT_ID)) return; // отвечаем только на сообщения из чата админа

  if (msg.text === "/start" || msg.text === "/help") {
    await sendMessage(
      "Сюда приходят сообщения курьеров из приложения.\n\n" +
        "Чтобы ответить конкретному курьеру — сделайте Reply (ответить) прямо на его сообщение здесь, в Telegram. " +
        "Ваш ответ автоматически появится у курьера в приложении."
    );
    return;
  }

  const text: string | undefined = msg.text || msg.caption;
  const courierId = extractCourierId(msg.reply_to_message?.text || msg.reply_to_message?.caption);

  if (!courierId) {
    await sendMessage(
      "Не понял, какому курьеру это адресовано — сделайте Reply на сообщение курьера, чтобы ответить именно ему."
    );
    return;
  }
  if (!text) {
    await sendMessage("Пока поддерживаются только текстовые ответы из Telegram (без фото/видео).");
    return;
  }

  db.insert(chatMessages).values({ courierId, senderType: "ADMIN", text, mediaUrls: "[]" }).run();
  db.insert(notifications)
    .values({ courierId, type: "CHAT_REPLY", message: `Новый ответ от администратора: ${text}` })
    .run();

  await sendMessage("✅ Отправлено курьеру", msg.message_id);
}

async function poll() {
  if (!API) return;
  try {
    const res = await fetch(`${API}/getUpdates?timeout=25&offset=${offset}`);
    const data = (await res.json()) as { ok: boolean; result?: any[] };
    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        await handleUpdate(update);
      }
    }
  } catch (err) {
    console.error("[telegram-bot] ошибка опроса", err);
  } finally {
    if (running) setTimeout(poll, 1000);
  }
}

export function startTelegramBot() {
  if (!API || !ADMIN_CHAT_ID) {
    console.warn("[telegram-bot] TELEGRAM_BOT_TOKEN/TELEGRAM_ADMIN_CHAT_ID не заданы — бот-мост не запущен");
    return;
  }
  running = true;
  console.log("[telegram-bot] запущен (long polling)");
  poll();
}
