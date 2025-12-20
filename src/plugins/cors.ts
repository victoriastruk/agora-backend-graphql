import cors from "@elysiajs/cors";
import { env } from "@/shared/config/env";

export const corsPlugin = cors({
  origin: env.CORS_ORIGIN || true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  credentials: true,
  maxAge: 86400,
});
