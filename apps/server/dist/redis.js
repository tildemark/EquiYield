import Redis from 'ioredis';
let redis = null;
export function getRedis() {
    if (!redis) {
        const url = process.env.REDIS_URL;
        if (!url)
            throw new Error('REDIS_URL not configured');
        redis = new Redis(url);
    }
    return redis;
}
export const REDIS_KEYS = {
    systemConfig: 'systemConfig',
    estimatedDividendPerShare: (year) => `dividend:estimated:perShare:${year}`,
};
