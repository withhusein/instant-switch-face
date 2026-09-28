import redis from './_redis.js';

export default async function handler(req, res) {
  try {
    const rawItem = await redis.lpop('pdooh_queue');

    if (!rawItem) {
      return res.status(200).json({
        hasContent: false,
        message: 'Queue is empty'
      });
    }

    const t5_time = new Date().toISOString();
    const queueItem = typeof rawItem === 'string' ? JSON.parse(rawItem) : rawItem;

    const logs = await redis.lrange('pdooh_logs', 0, -1);
    if (logs && logs.length > 0) {
      const updatedLogs = logs.map(logRaw => {
        const log = typeof logRaw === 'string' ? JSON.parse(logRaw) : logRaw;
        if (log.jobId === queueItem.jobId) {
          log.status = 'PLAYED_ON_VIDEOTRON';
          log.timestamps.t5_player_fetched = t5_time;
          
          const t1Date = new Date(log.timestamps.t1_microsite_uploaded);
          const t5Date = new Date(t5_time);
          log.durations.totalLatencySec = parseFloat(((t5Date - t1Date) / 1000).toFixed(2));
        }
        return log;
      });

      await redis.del('pdooh_logs');
      const stringifiedLogs = updatedLogs.map(item => JSON.stringify(item));
      await redis.rpush('pdooh_logs', ...stringifiedLogs);
    }

    return res.status(200).json({
      hasContent: true,
      content: queueItem
    });

  } catch (error) {
    console.error('[QUEUE_ERROR]', error);
    return res.status(500).json({ error: error.message });
  }
}