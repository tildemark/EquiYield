import { prisma } from '../prisma.js';
import { getRedis, REDIS_KEYS } from '../redis.js';
export async function getSystemConfigCached() {
    const redis = getRedis();
    const cached = await redis.get(REDIS_KEYS.systemConfig);
    if (cached)
        return JSON.parse(cached);
    const cfg = await prisma.systemConfig.findUnique({ where: { id: 1 } });
    if (!cfg)
        throw new Error('SystemConfig not initialized');
    const value = {
        min_shares: cfg.min_shares,
        max_shares: cfg.max_shares,
        share_value: cfg.share_value,
        min_loan_amount: cfg.min_loan_amount,
        max_loan_amount: cfg.max_loan_amount,
    };
    await redis.set(REDIS_KEYS.systemConfig, JSON.stringify(value));
    return value;
}
export async function invalidateSystemConfigCache() {
    const redis = getRedis();
    await redis.del(REDIS_KEYS.systemConfig);
}
