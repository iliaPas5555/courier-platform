import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

const uploadDir = process.env.UPLOAD_DIR || "./uploads";
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

const ALLOWED = /\.(jpg|jpeg|png|webp|heic|mp4|mov|webm|m4v)$/i;

export const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 5 }, // до 50MB на файл, до 5 файлов
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.test(file.originalname)) {
      return cb(new Error("Разрешены только фото (jpg/png/webp/heic) и видео (mp4/mov/webm)"));
    }
    cb(null, true);
  },
});

export function fileUrl(req: { protocol: string; get(name: string): string | undefined }, filename: string) {
  return `${req.protocol}://${req.get("host")}/uploads/${filename}`;
}
