import redis from './_redis.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }

    const userName = body?.userName || body?.name || 'Anonymous';
    const rawImage = body?.userImageUrl || body?.imageBase64 || body?.image;

    if (!rawImage) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const t1_time = new Date().toISOString();

    // 1. Jika gambar berupa Base64, upload temporary ke tmpfiles.org agar dapat URL Publik
    let publicImageUrl = rawImage;
    if (rawImage.startsWith('data:')) {
      publicImageUrl = await uploadBase64ToPublicUrl(rawImage);
    }

    // Target face (misal: template videotron Ronaldo)
    const targetFaceUrl = process.env.TARGET_FACE_URL || "https://instant-switch-face.vercel.app/ronaldo.jpg";

    // 2. Panggil Magic Hour Face Swap API menggunakan HTTPS URL
    const magicHourResponse = await fetch('https://api.magichour.ai/v1/face-swap', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MAGIC_HOUR_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assets: {
          image_file_path: publicImageUrl,
          target_file_path: targetFaceUrl
        },
        name: `pDOOH_${userName}_${jobId}`
      })
    });

    const aiData = await magicHourResponse.json();

    if (!magicHourResponse.ok) {
      console.error('[MAGIC_HOUR_ERROR]', aiData);
      throw new Error(aiData.message || JSON.stringify(aiData));
    }

    // 3. Catat Log ke Redis Cloud
    const logEntry = {
      jobId,
      userName,
      magicHourId: aiData.id,
      status: 'PROCESSING_IN_AI',
      assetMetrics: {
        rawUploadSizeKB: body?.rawSizeKB || 0,
        frontendCompressedSizeKB: body?.compressedSizeKB || 0,
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

    await redis.lpush('pdooh_logs', JSON.stringify(logEntry));
    await redis.set(`job_map:${aiData.id}`, JSON.stringify(logEntry));

    return res.status(200).json({
      success: true,
      jobId,
      magicHourId: aiData.id,
      message: 'Foto berhasil dikirim dan sedang diproses AI!'
    });

  } catch (error) {
    console.error('[SUBMIT_ERROR]', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

// Helper untuk convert Base64 ke Temporary Public URL
async function uploadBase64ToPublicUrl(base64Data) {
  try {
    const base64Content = base64Data.split(',')[1] || base64Data;
    const buffer = Buffer.from(base64Content, 'base64');

    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'image/jpeg' });
    formData.append('file', blob, 'upload.jpg');

    const res = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data?.data?.url) {
      // Ubah url tmpfiles ke format direct file link
      return data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    }
    throw new Error('Failed to obtain public URL from temp storage');
  } catch (err) {
    console.error('[UPLOAD_TEMP_ERROR]', err);
    throw err;
  }
}