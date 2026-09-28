export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const t4_webhook = new Date().toISOString();

  try {
    const payload = req.body;
    const jobId = payload.id || payload.job_id;
    const status = payload.status;
    const downloadUrl = payload.download_url || payload.result?.url;

    global.pDOOH_LOGS = global.pDOOH_LOGS || {};
    global.pDOOH_QUEUE = global.pDOOH_QUEUE || [];

    let logEntry = global.pDOOH_LOGS[jobId] || {
      jobId: jobId,
      userName: 'Racer',
      timestamps: {},
      assetMetrics: {},
      durations: {}
    };

    if (status === 'complete' && downloadUrl) {
      // Hitung ukuran file hasil AI
      let processedSizeKB = 0;
      try {
        const headRes = await fetch(downloadUrl, { method: 'HEAD' });
        const contentLength = headRes.headers.get('content-length');
        if (contentLength) {
          processedSizeKB = (parseInt(contentLength, 10) / 1024).toFixed(2);
        }
      } catch (e) {
        console.error("Gagal menghitung ukuran file hasil:", e);
      }

      // Hitung Durasi AI
      const t3Time = logEntry.timestamps.t3_sent_to_magic_hour ? new Date(logEntry.timestamps.t3_sent_to_magic_hour) : new Date();
      const aiTimeSec = ((new Date(t4_webhook) - t3Time) / 1000).toFixed(2);

      logEntry.status = 'READY_FOR_DOOH';
      logEntry.resultUrl = downloadUrl;
      logEntry.timestamps.t4_webhook_completed = t4_webhook;
      logEntry.assetMetrics.processedAssetSizeKB = parseFloat(processedSizeKB);
      logEntry.durations.aiProcessingTimeSec = parseFloat(aiTimeSec);

      global.pDOOH_LOGS[jobId] = logEntry;

      // Masukkan ke antrean Player Engine
      global.pDOOH_QUEUE.push({
        jobId: jobId,
        userName: logEntry.userName,
        url: downloadUrl,
        readyAt: t4_webhook
      });

      console.log(`[pDOOH WEBHOOK SUCCESS] Job ${jobId} selesai dalam ${aiTimeSec}s`);
    } else {
      logEntry.status = 'FAILED_IN_AI';
      logEntry.timestamps.t4_webhook_completed = t4_webhook;
      global.pDOOH_LOGS[jobId] = logEntry;
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error("Webhook Processing Error:", error);
    return res.status(500).json({ error: error.message });
  }
}