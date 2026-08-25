import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/client";
import { chatMessages, couriers, notifications } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { upload, fileUrl } from "../middleware/upload";
import { notifyAdminNewMessage } from "../services/telegram";

export const chatRouter = Router();

function parseMedia(json: string): string[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

// Курьер: моя переписка
chatRouter.get("/me", requireAuth("courier"), (req, res) => {
  const list = db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.courierId, req.auth!.id))
    .orderBy(chatMessages.createdAt)
    .all();
  db.update(chatMessages)
    .set({ readByCourier: true })
    .where(and(eq(chatMessages.courierId, req.auth!.id), eq(chatMessages.senderType, "ADMIN")))
    .run();
  res.json(list.map((m) => ({ ...m, mediaUrls: parseMedia(m.mediaUrls) })));
});

// Курьер: отправить сообщение (текст и/или до 5 фото/видео) — пересылается в TG-бота
chatRouter.post("/me", requireAuth("courier"), upload.array("media", 5), async (req, res) => {
  const text = (req.body?.text as string | undefined)?.trim() || null;
  const files = (req.files as Express.Multer.File[]) || [];
  if (!text && files.length === 0) {
    return res.status(400).json({ error: "Добавьте текст или вложение" });
  }
  const mediaUrls = files.map((f) => fileUrl(req, f.filename));

  const message = db
    .insert(chatMessages)
    .values({ courierId: req.auth!.id, senderType: "COURIER", text, mediaUrls: JSON.stringify(mediaUrls) })
    .returning()
    .get();

  const courier = db.select().from(couriers).where(eq(couriers.id, req.auth!.id)).get();
  await notifyAdminNewMessage({
    courierName: courier?.fullName || req.auth!.id,
    courierId: req.auth!.id,
    text,
    mediaUrls,
  });

  res.status(201).json({ ...message, mediaUrls });
});

// Админ: переписка с конкретным курьером
chatRouter.get("/:courierId", requireAuth("admin"), (req, res) => {
  const list = db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.courierId, req.params.courierId))
    .orderBy(chatMessages.createdAt)
    .all();
  db.update(chatMessages)
    .set({ readByAdmin: true })
    .where(and(eq(chatMessages.courierId, req.params.courierId), eq(chatMessages.senderType, "COURIER")))
    .run();
  res.json(list.map((m) => ({ ...m, mediaUrls: parseMedia(m.mediaUrls) })));
});

// Админ: список диалогов с непрочитанными (для панели)
chatRouter.get("/", requireAuth("admin"), (_req, res) => {
  const list = db.select().from(chatMessages).orderBy(desc(chatMessages.createdAt)).all();
  const byCourier = new Map<string, { lastMessage: string | null; unread: number; lastAt: Date }>();
  for (const m of list) {
    const cur = byCourier.get(m.courierId);
    if (!cur) {
      byCourier.set(m.courierId, {
        lastMessage: m.text,
        unread: m.senderType === "COURIER" && !m.readByAdmin ? 1 : 0,
        lastAt: m.createdAt,
      });
    } else if (m.senderType === "COURIER" && !m.readByAdmin) {
      cur.unread += 1;
    }
  }
  res.json(Array.from(byCourier.entries()).map(([courierId, v]) => ({ courierId, ...v })));
});

// Админ: ответить курьеру (текст и/или медиа) — из своей панели или через TG-бота (см. /telegram-bot)
chatRouter.post("/:courierId", requireAuth("admin"), upload.array("media", 5), (req, res) => {
  const text = (req.body?.text as string | undefined)?.trim() || null;
  const files = (req.files as Express.Multer.File[]) || [];
  if (!text && files.length === 0) {
    return res.status(400).json({ error: "Добавьте текст или вложение" });
  }
  const mediaUrls = files.map((f) => fileUrl(req, f.filename));

  const message = db
    .insert(chatMessages)
    .values({
      courierId: req.params.courierId,
      senderType: "ADMIN",
      text,
      mediaUrls: JSON.stringify(mediaUrls),
    })
    .returning()
    .get();

  db.insert(notifications)
    .values({
      courierId: req.params.courierId,
      type: "CHAT_REPLY",
      message: text ? `Новый ответ от администратора: ${text}` : "Новый ответ от администратора",
    })
    .run();

  res.status(201).json({ ...message, mediaUrls });
});

// Внутренний эндпоинт для telegram-bot сервиса: админ ответил прямо в Telegram.
// Защищён отдельным сервисным токеном, а не пользовательским JWT.
chatRouter.post("/internal/from-telegram", (req, res) => {
  const serviceToken = req.headers["x-service-token"];
  if (!process.env.TELEGRAM_BRIDGE_TOKEN || serviceToken !== process.env.TELEGRAM_BRIDGE_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const { courierId, text } = req.body as { courierId?: string; text?: string };
  if (!courierId || !text) return res.status(400).json({ error: "courierId и text обязательны" });

  const message = db
    .insert(chatMessages)
    .values({ courierId, senderType: "ADMIN", text, mediaUrls: "[]" })
    .returning()
    .get();
  db.insert(notifications)
    .values({ courierId, type: "CHAT_REPLY", message: `Новый ответ от администратора: ${text}` })
    .run();

  res.status(201).json(message);
});
