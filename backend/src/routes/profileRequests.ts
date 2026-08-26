// Заявки курьеров на изменение анкетных данных. Курьер сам менять профиль не может —
// он отправляет заявку, админ её одобряет (тогда данные применяются) или отклоняет.
import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../db/client";
import { profileChangeRequests, couriers, notifications } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { upload, fileUrl } from "../middleware/upload";

export const profileRequestsRouter = Router();

const EDITABLE_FIELDS = ["fullName", "phone", "medBookNumber", "bikeNumber"] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

function fieldLabel(f: string) {
  return (
    { fullName: "ФИО", phone: "Телефон", medBookNumber: "Мед. книжка", bikeNumber: "Велосипед", photoUrl: "Фото" }[
      f
    ] || f
  );
}

// Курьер: отправить заявку на изменение анкеты (только изменившиеся поля + опционально новое фото)
profileRequestsRouter.post("/", requireAuth("courier"), upload.single("photo"), (req, res) => {
  const courier = db.select().from(couriers).where(eq(couriers.id, req.auth!.id)).get();
  if (!courier) return res.status(404).json({ error: "Курьер не найден" });

  const pending = db
    .select()
    .from(profileChangeRequests)
    .where(and(eq(profileChangeRequests.courierId, req.auth!.id), eq(profileChangeRequests.status, "PENDING")))
    .get();
  if (pending) {
    return res.status(409).json({ error: "У вас уже есть заявка на рассмотрении — дождитесь решения администратора" });
  }

  const changes: Partial<Record<EditableField | "photoUrl", string>> = {};
  for (const field of EDITABLE_FIELDS) {
    const value = (req.body?.[field] as string | undefined)?.trim();
    if (value && value !== String(courier[field] ?? "")) changes[field] = value;
  }
  if (req.file) changes.photoUrl = fileUrl(req, req.file.filename);

  if (Object.keys(changes).length === 0) {
    return res.status(400).json({ error: "Нет изменений для отправки" });
  }

  const request = db
    .insert(profileChangeRequests)
    .values({ courierId: req.auth!.id, changes: JSON.stringify(changes) })
    .returning()
    .get();

  res.status(201).json({ ...request, changes });
});

// Курьер: моя последняя заявка (если есть) + краткая история
profileRequestsRouter.get("/me", requireAuth("courier"), (req, res) => {
  const list = db
    .select()
    .from(profileChangeRequests)
    .where(eq(profileChangeRequests.courierId, req.auth!.id))
    .orderBy(desc(profileChangeRequests.createdAt))
    .limit(10)
    .all();
  res.json(list.map((r) => ({ ...r, changes: JSON.parse(r.changes) })));
});

// Админ: список заявок (по умолчанию — только PENDING)
profileRequestsRouter.get("/", requireAuth("admin"), (req, res) => {
  const status = (req.query.status as string | undefined) || "PENDING";
  const list =
    status === "ALL"
      ? db.select().from(profileChangeRequests).orderBy(desc(profileChangeRequests.createdAt)).all()
      : db
          .select()
          .from(profileChangeRequests)
          .where(eq(profileChangeRequests.status, status))
          .orderBy(desc(profileChangeRequests.createdAt))
          .all();

  const courierIds = [...new Set(list.map((r) => r.courierId))];
  const allCouriers = courierIds.length
    ? db.select().from(couriers).all().filter((c) => courierIds.includes(c.id))
    : [];
  const byId = new Map(allCouriers.map((c) => [c.id, c]));

  res.json(
    list.map((r) => ({
      ...r,
      changes: JSON.parse(r.changes),
      courier: byId.get(r.courierId)
        ? { id: byId.get(r.courierId)!.id, fullName: byId.get(r.courierId)!.fullName, phone: byId.get(r.courierId)!.phone }
        : null,
    }))
  );
});

// Админ: одобрить — применяет изменения к профилю курьера
profileRequestsRouter.patch("/:id/approve", requireAuth("admin"), (req, res) => {
  const request = db.select().from(profileChangeRequests).where(eq(profileChangeRequests.id, req.params.id)).get();
  if (!request) return res.status(404).json({ error: "Заявка не найдена" });
  if (request.status !== "PENDING") return res.status(409).json({ error: "Заявка уже рассмотрена" });

  const changes = JSON.parse(request.changes) as Record<string, string>;
  db.update(couriers).set(changes).where(eq(couriers.id, request.courierId)).run();

  const updated = db
    .update(profileChangeRequests)
    .set({ status: "APPROVED", reviewedAt: new Date() })
    .where(eq(profileChangeRequests.id, request.id))
    .returning()
    .get();

  const changedFields = Object.keys(changes).map(fieldLabel).join(", ");
  db.insert(notifications)
    .values({
      courierId: request.courierId,
      type: "PROFILE_REQUEST",
      message: `Изменения анкеты одобрены: ${changedFields}`,
    })
    .run();

  res.json({ ...updated, changes });
});

// Админ: отклонить заявку
profileRequestsRouter.patch("/:id/reject", requireAuth("admin"), (req, res) => {
  const request = db.select().from(profileChangeRequests).where(eq(profileChangeRequests.id, req.params.id)).get();
  if (!request) return res.status(404).json({ error: "Заявка не найдена" });
  if (request.status !== "PENDING") return res.status(409).json({ error: "Заявка уже рассмотрена" });

  const note = (req.body?.note as string | undefined)?.trim() || null;
  const updated = db
    .update(profileChangeRequests)
    .set({ status: "REJECTED", adminNote: note, reviewedAt: new Date() })
    .where(eq(profileChangeRequests.id, request.id))
    .returning()
    .get();

  db.insert(notifications)
    .values({
      courierId: request.courierId,
      type: "PROFILE_REQUEST",
      message: `Изменения анкеты отклонены${note ? `: ${note}` : ""}`,
    })
    .run();

  res.json({ ...updated, changes: JSON.parse(updated.changes) });
});
