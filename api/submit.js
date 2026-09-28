import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userName, imageBase64, rawUploadSizeKB, frontendCompressedSizeKB } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const t1_time = new Date().toISOString();

    // 1. Panggil Magic Hour API (Face Swap)
    const magicHourResponse = await fetch('https://api.magichour.ai/v1/face-swap', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MAGIC_HOUR_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assets: {
          image_file_path: imageBase64
        },
        name: `pDOOH_${userName}_${jobId}`
      })
    });

    const aiData = await magicHourResponse.json();

    if (!magicHourResponse.ok) {
      throw new Error(aiData.message || 'Magic Hour API error');
    }

    // 2. Buat Log Record
    const logEntry = {
      jobId,
      userName: userName || 'Anonymous',
      magicHourId: aiData.id,
      status: 'PROCESSING_IN_AI',
      assetMetrics: {
        rawUploadSizeKB: rawUploadSizeKB || 0,
        frontendCompressedSizeKB: frontendCompressedSizeKB || 0,
        processedAssetSizeKB: null
      },
      durations: {
        aiProcessingTimeSec: null,
        totalLatencySec: null
      },
      timestamps: {
        t1_microsite_uploaded: t1_time,
        t4_webhook_completed: null,
        t5_player_fetched: null
      }
    };

    // 3. Simpan Log & Mapping Job ID ke Redis
    await kv.lpush('pdooh_logs', logEntry);
    await kv.set(`job_map:${aiData.id}`, logEntry);

    return res.status(200).json({
      success: true,
      jobId,
      magicHourId: aiData.id,
      message: 'Foto diterima dan sedang diproses AI.'
    });

  } catch (error) {
    console.error('[SUBMIT_ERROR]', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}