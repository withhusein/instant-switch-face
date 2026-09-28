import redis from './_redis.js';

export default async function handler(req, res) {
  try {
    const rawLogs = await redis.lrange('pdooh_logs', 0, 50);

    const logs = (rawLogs || []).map(item => {
      try {
        return typeof item === 'string' ? JSON.parse(item) : item;
      } catch (e) {
        return item;
      }
    });

    return res.status(200).json({
      success: true,
      total: logs.length,
      logs
    });

  } catch (error) {
    console.error('[LOG_API_ERROR]', error);
    return res.status(500).json({ error: error.message, logs: [] });
  }
}