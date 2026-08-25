import { Request, Response, NextFunction } from "express";
import { verifyToken, Role } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      auth?: { id: string; role: Role };
    }
  }
}

export function requireAuth(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Нет токена авторизации" });
    }
    const payload = verifyToken(header.slice("Bearer ".length));
    if (!payload) {
      return res.status(401).json({ error: "Недействительный токен" });
    }
    if (roles.length && !roles.includes(payload.role)) {
      return res.status(403).json({ error: "Недостаточно прав" });
    }
    req.auth = payload;
    next();
  };
}
