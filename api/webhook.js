import redis from './_redis.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { id, status, download_url } = req.body;
    const t4_time = new Date().toISOString();

    // Ambil mapping job dari Redis
    const rawJob = await redis.get(`job_map:${id}`);
    const logEntry = typeof rawJob === 'string' ? JSON.parse(rawJob) : rawJob;

    if (!logEntry) {
      console.warn(`[WEBHOOK] Job mapping not found for Magic Hour ID: ${id}`);
      return res.status(200).json({ message: 'Job not found, webhook ignored' });
    }

    if (status === 'success' && download_url) {
      const t1Date = new Date(logEntry.timestamps.t1_microsite_uploaded);
      const t4Date = new Date(t4_time);
      const aiProcessingTimeSec = ((t4Date - t1Date) / 1000).toFixed(2);

      let processedAssetSizeKB = 0;
      try {
        const headRes = await fetch(download_url, { method: 'HEAD' });
        const contentLength = headRes.headers.get('content-length');
        if (contentLength) {
          processedAssetSizeKB = (parseInt(contentLength, 10) / 1024).toFixed(2);
        }
      } catch (e) {
        console.warn('Failed to fetch image size:', e.message);
      }

      logEntry.status = 'READY_FOR_DOOH';
      logEntry.timestamps.t4_webhook_completed = t4_time;
      logEntry.durations.aiProcessingTimeSec = parseFloat(aiProcessingTimeSec);
      logEntry.assetMetrics.processedAssetSizeKB = parseFloat(processedAssetSizeKB);

      const queueItem = {
        jobId: logEntry.jobId,
        userName: logEntry.userName,
        imageUrl: download_url,
        createdAt: t4_time
      };

      await redis.rpush('pdooh_queue', JSON.stringify(queueItem));
      await updateLogList(logEntry);

    } else if (status === 'error') {
      logEntry.status = 'FAILED_IN_AI';
      await updateLogList(logEntry);
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('[WEBHOOK_ERROR]', error);
    return res.status(500).json({ error: error.message });
  }
}

async function updateLogList(updatedEntry) {
  const logs = await redis.lrange('pdooh_logs', 0, -1);
  if (!logs) return;

  const updatedLogs = logs.map(item => {
    const entry = typeof item === 'string' ? JSON.parse(item) : item;
    return entry.jobId === updatedEntry.jobId ? updatedEntry : entry;
  });

  await redis.del('pdooh_logs');
  if (updatedLogs.length > 0) {
    const stringifiedLogs = updatedLogs.map(item => JSON.stringify(item));
    await redis.rpush('pdooh_logs', ...stringifiedLogs);
  }
}