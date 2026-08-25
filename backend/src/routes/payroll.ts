// Загрузка еженедельного реестра выплат (.xlsx) админом: одним файлом сразу
// проставляем начисления всем курьерам — баланс суммируется каждую неделю.
// Ожидаемые колонки (порядок не важен, есть гибкое распознавание заголовков):
//   ФИО | телефон | заработано за неделю | баланс | получено на руки | период
import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import * as XLSX from "xlsx";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db/client";
import { payrollEntries, couriers, notifications } from "../db/schema";
import { requireAuth } from "../middleware/auth";

export const payrollRouter = Router();

const registerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/\.(xlsx|xls)$/i.test(file.originalname)) {
      return cb(new Error("Ожидается файл реестра в формате .xlsx"));
    }
    cb(null, true);
  },
});

function normalizePhone(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.slice(-10); // сравниваем по последним 10 цифрам — не зависит от +7/8/7
}

function toKopecks(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "0").replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function findHeaderKey(headerRow: unknown[], patterns: RegExp[]): number {
  for (let i = 0; i < headerRow.length; i++) {
    const cell = String(headerRow[i] ?? "").trim().toLowerCase();
    if (patterns.some((p) => p.test(cell))) return i;
  }
  return -1;
}

// Админ: загрузить реестр .xlsx — начисления всем курьерам из файла
payrollRouter.post("/upload", requireAuth("admin"), registerUpload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Файл не получен" });

  let rows: unknown[][];
  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" }) as unknown[][];
  } catch {
    return res.status(400).json({ error: "Не удалось прочитать файл — проверьте, что это корректный .xlsx" });
  }
  if (rows.length < 2) return res.status(400).json({ error: "В файле нет строк с данными" });

  const header = rows[0];
  const idx = {
    fullName: findHeaderKey(header, [/фио/, /имя/, /name/]),
    phone: findHeaderKey(header, [/телефон/, /phone/]),
    earned: findHeaderKey(header, [/заработ/, /earned/]),
    held: findHeaderKey(header, [/баланс/, /balance/]),
    paidOut: findHeaderKey(header, [/получен/, /руки/, /paid/]),
    period: findHeaderKey(header, [/период/, /period/]),
  };
  if (idx.phone === -1 || idx.held === -1) {
    return res.status(400).json({
      error: "Не нашёл в файле колонки «телефон» и «баланс» — проверьте заголовки первой строки",
    });
  }

  const allCouriers = db.select().from(couriers).all();
  const byPhone = new Map(allCouriers.map((c) => [normalizePhone(c.phone), c]));

  const batchId = randomUUID();
  const matched: { courierId: string; fullName: string; period: string; heldAmount: number }[] = [];
  const unmatched: { row: number; fullName: string; phone: string }[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c === "" || c == null)) continue; // пустая строка

    const phoneRaw = row[idx.phone];
    const normPhone = normalizePhone(phoneRaw);
    const fullNameCell = idx.fullName !== -1 ? String(row[idx.fullName] ?? "").trim() : "";
    const courier = normPhone ? byPhone.get(normPhone) : undefined;

    if (!courier) {
      unmatched.push({ row: r + 1, fullName: fullNameCell, phone: String(phoneRaw ?? "") });
      continue;
    }

    const period = idx.period !== -1 ? String(row[idx.period] ?? "").trim() : "";
    const earnedAmount = idx.earned !== -1 ? toKopecks(row[idx.earned]) : 0;
    const heldAmount = toKopecks(row[idx.held]);
    const paidOutAmount = idx.paidOut !== -1 ? toKopecks(row[idx.paidOut]) : 0;

    db.insert(payrollEntries)
      .values({
        courierId: courier.id,
        period: period || "—",
        earnedAmount,
        heldAmount,
        paidOutAmount,
        batchId,
        sourceFileName: req.file!.originalname,
      })
      .run();

    if (heldAmount !== 0) {
      db.update(couriers)
        .set({ balance: sql`${couriers.balance} + ${heldAmount}` })
        .where(eq(couriers.id, courier.id))
        .run();
    }

    matched.push({ courierId: courier.id, fullName: courier.fullName, period, heldAmount });
  }

  for (const m of matched) {
    db.insert(notifications)
      .values({
        courierId: m.courierId,
        type: "PAYROLL_ENTRY",
        message: `Начислено за период ${m.period || "—"}: на баланс ${(m.heldAmount / 100).toFixed(2)} ₽`,
      })
      .run();
  }

  res.json({
    batchId,
    matchedCount: matched.length,
    unmatchedCount: unmatched.length,
    unmatched,
  });
});

// Курьер: мои начисления из реестра
payrollRouter.get("/me", requireAuth("courier"), (req, res) => {
  const list = db
    .select()
    .from(payrollEntries)
    .where(eq(payrollEntries.courierId, req.auth!.id))
    .orderBy(desc(payrollEntries.createdAt))
    .all();
  res.json(list);
});

// Админ: начисления по курьеру (или последние по всем)
payrollRouter.get("/", requireAuth("admin"), (req, res) => {
  const courierId = req.query.courierId as string | undefined;
  const list = courierId
    ? db.select().from(payrollEntries).where(eq(payrollEntries.courierId, courierId)).orderBy(desc(payrollEntries.createdAt)).all()
    : db.select().from(payrollEntries).orderBy(desc(payrollEntries.createdAt)).limit(200).all();
  res.json(list);
});
