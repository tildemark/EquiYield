import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import adminRouter from './routes/admin.js';
import authRouter from './routes/auth.js';
import memberRouter from './routes/member.js';
import { prisma } from './prisma.js';

const app = express();

// Security: Helmet
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production',
  crossOriginEmbedderPolicy: false,
}));

// Security: CORS
const corsOptions: cors.CorsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? (['https://equiyield.sanchez.ph', process.env.ALLOWED_ORIGIN].filter(Boolean) as string[])
    : '*',
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Security: Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.DEMO_MODE === 'true' ? 200 : 100, // Higher limit for demo
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});
app.use('/api/auth/login', authLimiter);

app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ 
    ok: true, 
    demoMode: process.env.DEMO_MODE === 'true',
    version: '1.0.0' 
  });
});

app.use('/api/auth', authRouter);
app.use('/api/member', memberRouter);
app.use('/api/admin', adminRouter);

const PORT = Number(process.env.PORT || 4000);

async function ensureSystemConfig() {
  // Ensure singleton SystemConfig exists, or create a default placeholder
  const existing = await prisma.systemConfig.findUnique({ where: { id: 1 } });
  if (!existing) {
      await prisma.systemConfig.create({ 
        data: { 
          id: 1, 
          min_shares: 1, 
          max_shares: 100, 
          share_value: 250,
          min_loan_amount: 1000,
          max_loan_amount: 100000
        } 
      });
  }
}

app.listen(PORT, async () => {
  await ensureSystemConfig();
  console.log(`[server] listening on http://localhost:${PORT}`);
  if (process.env.DEMO_MODE === 'true') {
    console.log('🎭 Running in DEMO MODE');
  }
});
