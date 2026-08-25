// Создаёт первого администратора. Запуск: npm run db:seed -- --phone=+79990000000 --password=admin123 --name="Илья"
import "dotenv/config";
import { db } from "./client";
import { admins } from "./schema";
import { hashPassword } from "../lib/auth";
import { eq } from "drizzle-orm";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v];
  })
);

const phone = args.phone || "+70000000000";
const password = args.password || "admin123";
const fullName = args.name || "Администратор";

const existing = db.select().from(admins).where(eq(admins.phone, phone)).get();
if (existing) {
  console.log(`Админ с телефоном ${phone} уже существует.`);
} else {
  db.insert(admins).values({ fullName, phone, passwordHash: hashPassword(password) }).run();
  console.log(`Создан админ: ${fullName}, телефон: ${phone}, пароль: ${password}`);
  console.log("Обязательно смените пароль в реальном использовании.");
}
