import type { CapacitorConfig } from "@capacitor/cli";

// Нативная Android-обёртка курьерского приложения. Экран открывает напрямую
// живой сайт (/app) — так апдейты бэкенда/фронта сразу видны в приложении
// без переустановки APK. При желании сменить адрес после переноса на свой домен —
// поменять server.url и пересобрать APK (см. .github/workflows/android-build.yml).
const config: CapacitorConfig = {
  appId: "ru.courierplatform.app",
  appName: "Курьер",
  webDir: "dist",
  server: {
    url: "https://courier-platform-clfo.onrender.com/app/",
    cleartext: false,
  },
};

export default config;
