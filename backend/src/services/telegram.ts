// Тонкий клиент Telegram Bot API — используется backend'ом, чтобы переслать
// сообщение курьера админу в Telegram. Приём ответов админа (Reply в Telegram)
// реализован тут же, в services/telegramBot.ts (long polling в этом же процессе).

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;

export async function notifyAdminNewMessage(params: {
  courierName: string;
  courierId: string;
  text?: string | null;
  mediaUrls: string[];
}) {
  if (!API || !ADMIN_CHAT_ID) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN/TELEGRAM_ADMIN_CHAT_ID не заданы — сообщение не отправлено в TG");
    return;
  }
  const caption =
    `Новое сообщение от курьера ${params.courierName}\n` +
    `(id: ${params.courierId})\n\n` +
    (params.text ? params.text : "[вложение без текста]");

  try {
    if (params.mediaUrls.length === 0) {
      await fetch(`${API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: caption }),
      });
      return;
    }
    // Пересылаем ссылки на медиа текстом — сами файлы отдаются backend'ом по /uploads/*
    // (для прод. окружения указывайте публичный URL backend'а в переменной PUBLIC_BASE_URL).
    await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: `${caption}\n\nВложения:\n${params.mediaUrls.join("\n")}`,
      }),
    });
  } catch (err) {
    console.error("[telegram] Не удалось отправить сообщение", err);
  }
}
