import { Router } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/client";
import { feedbackReports } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { upload, fileUrl } from "../middleware/upload";

export const feedbackRouter = Router();

function parseMedia(json: string): string[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

const typeSchema = z.enum(["LATE", "NO_SHOW", "OTHER"]);

// Курьер: отправить причину опоздания/невыхода (с фото/видео)
feedbackRouter.post("/", requireAuth("courier"), upload.array("media", 5), (req, res) => {
  const type = typeSchema.safeParse(req.body?.type);
  const reason = (req.body?.reason as string | undefined)?.trim();
  const shiftId = (req.body?.shiftId as string | undefined) || null;
  if (!type.success) return res.status(400).json({ error: "Укажите тип обращения: LATE, NO_SHOW или OTHER" });
  if (!reason) return res.status(400).json({ error: "Опишите причину" });

  const files = (req.files as Express.Multer.File[]) || [];
  const mediaUrls = files.map((f) => fileUrl(req, f.filename));

  const report = db
    .insert(feedbackReports)
    .values({
      courierId: req.auth!.id,
      shiftId,
      type: type.data,
      reason,
      mediaUrls: JSON.stringify(mediaUrls),
    })
    .returning()
    .get();

  res.status(201).json({ ...report, mediaUrls });
});

// Курьер: мои обращения
feedbackRouter.get("/me", requireAuth("courier"), (req, res) => {
  const list = db
    .select()
    .from(feedbackReports)
    .where(eq(feedbackReports.courierId, req.auth!.id))
    .orderBy(desc(feedbackReports.createdAt))
    .all();
  res.json(list.map((r) => ({ ...r, mediaUrls: parseMedia(r.mediaUrls) })));
});

// Админ: все обращения (с фильтром по курьеру и статусу через query)
feedbackRouter.get("/", requireAuth("admin"), (req, res) => {
  const courierId = req.query.courierId as string | undefined;
  let list = db.select().from(feedbackReports).orderBy(desc(feedbackReports.createdAt)).all();
  if (courierId) list = list.filter((r) => r.courierId === courierId);
  res.json(list.map((r) => ({ ...r, mediaUrls: parseMedia(r.mediaUrls) })));
});

// Админ: отметить обращение рассмотренным
feedbackRouter.patch("/:id/reviewed", requireAuth("admin"), (req, res) => {
  const updated = db
    .update(feedbackReports)
    .set({ status: "REVIEWED" })
    .where(eq(feedbackReports.id, req.params.id))
    .returning()
    .get();
  if (!updated) return res.status(404).json({ error: "Обращение не найдено" });
  res.json(updated);
});
