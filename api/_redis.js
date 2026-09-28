import Redis from 'ioredis';

// Mengambil URL koneksi dari Redis Cloud (Vercel Environment)
const redisUrl = process.env.REDIS_URL || process.env.KV_URL;

if (!redisUrl) {
  console.error('[REDIS ERROR] REDIS_URL atau KV_URL tidak ditemukan di Environment Variables!');
}

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  connectTimeout: 5000,
});

export default redis;