import { Router } from "express";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/client";
import { admins } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { hashPassword } from "../lib/auth";

export const adminsRouter = Router();

function stripSecret<T extends { passwordHash?: unknown }>(a: T) {
  const { passwordHash, ...rest } = a;
  return rest;
}

// Список администраторов — виден только другим админам.
adminsRouter.get("/", requireAuth("admin"), (_req, res) => {
  const list = db.select().from(admins).orderBy(desc(admins.createdAt)).all();
  res.json(list.map(stripSecret));
});

const registerSchema = z.object({
  fullName: z.string().min(2, "Укажите ФИО"),
  phone: z.string().min(5, "Укажите телефон"),
  password: z.string().min(6, "Пароль минимум 6 символов"),
});

// Регистрация нового администратора — доступна только уже авторизованному админу
// (публичной саморегистрации для админки нет специально).
adminsRouter.post("/register", requireAuth("admin"), (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const existing = db.select().from(admins).where(eq(admins.phone, parsed.data.phone)).get();
  if (existing) return res.status(409).json({ error: "Администратор с таким телефоном уже существует" });

  const admin = db
    .insert(admins)
    .values({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      passwordHash: hashPassword(parsed.data.password),
    })
    .returning()
    .get();

  res.status(201).json(stripSecret(admin));
});

// Удалить администратора — нельзя удалить самого себя (иначе можно остаться без доступа).
adminsRouter.delete("/:id", requireAuth("admin"), (req, res) => {
  if (req.params.id === req.auth!.id) {
    return res.status(400).json({ error: "Нельзя удалить свою же учётную запись" });
  }
  const admin = db.select().from(admins).where(eq(admins.id, req.params.id)).get();
  if (!admin) return res.status(404).json({ error: "Администратор не найден" });

  db.delete(admins).where(eq(admins.id, req.params.id)).run();
  res.status(204).end();
});
