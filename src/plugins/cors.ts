import cors from '@elysiajs/cors';
import { env } from '@/shared/config/env';

const isDevelopment = env.NODE_ENV === 'development';

export const corsPlugin = cors({
  origin: isDevelopment ? true : env.CORS_ORIGIN,
  methods: ['GET', 'POST'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  credentials: true,
  maxAge: 86400,
});