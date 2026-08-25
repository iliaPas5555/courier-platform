import { Router } from "express";
import { eq, desc, and, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { notifications } from "../db/schema";
import { requireAuth } from "../middleware/auth";

export const notificationsRouter = Router();

// Курьер: мои уведомления
notificationsRouter.get("/me", requireAuth("courier"), (req, res) => {
  const list = db
    .select()
    .from(notifications)
    .where(eq(notifications.courierId, req.auth!.id))
    .orderBy(desc(notifications.sentAt))
    .limit(100)
    .all();
  res.json(list);
});

notificationsRouter.get("/me/unread-count", requireAuth("courier"), (req, res) => {
  const count = db
    .select()
    .from(notifications)
    .where(and(eq(notifications.courierId, req.auth!.id), isNull(notifications.readAt)))
    .all().length;
  res.json({ count });
});

notificationsRouter.patch("/:id/read", requireAuth("courier"), (req, res) => {
  const updated = db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, req.params.id), eq(notifications.courierId, req.auth!.id)))
    .returning()
    .get();
  if (!updated) return res.status(404).json({ error: "Уведомление не найдено" });
  res.json(updated);
});
