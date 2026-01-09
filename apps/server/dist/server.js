import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import adminRouter from './routes/admin.js';
import authRouter from './routes/auth.js';
import memberRouter from './routes/member.js';
import { prisma } from './prisma.js';
const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.get('/health', (_req, res) => {
    res.json({ ok: true });
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
});
