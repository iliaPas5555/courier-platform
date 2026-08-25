import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { authRouter } from "./routes/auth";
import { couriersRouter } from "./routes/couriers";
import { shiftsRouter } from "./routes/shifts";
import { paymentsRouter } from "./routes/payments";
import { chatRouter } from "./routes/chat";
import { feedbackRouter } from "./routes/feedback";
import { notificationsRouter } from "./routes/notifications";
import { startScheduler } from "./services/scheduler";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.resolve(process.env.UPLOAD_DIR || "./uploads")));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/couriers", couriersRouter);
app.use("/api/shifts", shiftsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/notifications", notificationsRouter);

// Отдаём собранное курьерское PWA (courier-app/dist) по пути /app — тем же сервером.
const courierDist = path.resolve(__dirname, "../../courier-app/dist");
if (fs.existsSync(courierDist)) {
  app.use("/app", express.static(courierDist));
  app.get(/^\/app(\/.*)?$/, (_req, res) => {
    res.sendFile(path.join(courierDist, "index.html"));
  });
}

// Отдаём собранную админ-панель (admin/dist) тем же сервером — единый порт/домен для деплоя.
const adminDist = path.resolve(__dirname, "../../admin/dist");
if (fs.existsSync(adminDist)) {
  app.use(express.static(adminDist));
  app.get(/^(?!\/api|\/uploads|\/app).*/, (_req, res) => {
    res.sendFile(path.join(adminDist, "index.html"));
  });
}

// Обработчик ошибок multer/zod и прочих — единая точка, чтобы не ронять процесс
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Внутренняя ошибка сервера" });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`Courier platform API запущен на порту ${PORT}`);
  if (fs.existsSync(adminDist)) console.log("Админ-панель отдаётся тем же сервером из admin/dist");
  if (fs.existsSync(courierDist)) console.log("Курьерское приложение отдаётся тем же сервером из courier-app/dist (/app)");
  startScheduler();
});
