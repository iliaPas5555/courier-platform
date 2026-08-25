import { Router } from "express";
import { z } from "zod";
import { db } from "../db/client";
import { admins, couriers } from "../db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, signToken } from "../lib/auth";
import { upload, fileUrl } from "../middleware/upload";

export const authRouter = Router();

const registerSchema = z.object({
  fullName: z.string().min(2, "Укажите ФИО"),
  phone: z.string().min(5, "Укажите телефон"),
  password: z.string().min(6, "Пароль минимум 6 символов"),
  medBookNumber: z.string().min(1, "Укажите номер медицинской книжки"),
  bikeNumber: z.string().min(1, "Укажите номер велосипеда"),
});

// Регистрация курьера. Фото — отдельным полем формы (multipart), необязательное на этом шаге,
// но UI должен требовать его до подтверждения анкеты.
authRouter.post("/courier/register", upload.single("photo"), (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { fullName, phone, password, medBookNumber, bikeNumber } = parsed.data;

  const existing = db.select().from(couriers).where(eq(couriers.phone, phone)).get();
  if (existing) {
    return res.status(409).json({ error: "Курьер с таким телефоном уже зарегистрирован" });
  }

  const photoUrl = req.file ? fileUrl(req, req.file.filename) : null;

  const courier = db
    .insert(couriers)
    .values({
      fullName,
      phone,
      passwordHash: hashPassword(password),
      medBookNumber,
      bikeNumber,
      photoUrl,
    })
    .returning()
    .get();

  const token = signToken({ id: courier.id, role: "courier" });
  res.status(201).json({ token, courier: { ...courier, passwordHash: undefined } });
});

const loginSchema = z.object({
  phone: z.string().min(5),
  password: z.string().min(1),
});

authRouter.post("/courier/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Укажите телефон и пароль" });

  const courier = db.select().from(couriers).where(eq(couriers.phone, parsed.data.phone)).get();
  if (!courier || !verifyPassword(parsed.data.password, courier.passwordHash)) {
    return res.status(401).json({ error: "Неверный телефон или пароль" });
  }
  const token = signToken({ id: courier.id, role: "courier" });
  res.json({ token, courier: { ...courier, passwordHash: undefined } });
});

authRouter.post("/admin/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Укажите телефон и пароль" });

  const admin = db.select().from(admins).where(eq(admins.phone, parsed.data.phone)).get();
  if (!admin || !verifyPassword(parsed.data.password, admin.passwordHash)) {
    return res.status(401).json({ error: "Неверный телефон или пароль" });
  }
  const token = signToken({ id: admin.id, role: "admin" });
  res.json({ token, admin: { ...admin, passwordHash: undefined } });
});
