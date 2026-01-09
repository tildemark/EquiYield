import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedis() {
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error('REDIS_URL not configured');
    redis = new Redis(url);
  }
  return redis;
}

export const REDIS_KEYS = {
  systemConfig: 'systemConfig',
  estimatedDividendPerShare: (year: number) => `dividend:estimated:perShare:${year}`,
};
