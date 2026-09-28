import redis from './_redis.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        console.error('[SUBMIT] Failed to parse body string:', e);
      }
    }

    const userName = body?.userName || body?.name || 'Anonymous';
    const finalImage = body?.userImageUrl || body?.imageBase64 || body?.image || body?.photo;

    if (!finalImage || typeof finalImage !== 'string' || finalImage.trim() === '') {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const t1_time = new Date().toISOString();

    // Gambar target template face swap (misal: gambar badan/template)
    const targetImageUrl = process.env.TARGET_FACE_URL || "https://instant-switch-face.vercel.app/ronaldo.jpg"; 

    // 1. Panggil Magic Hour API (Image Face Swap Endpoint)
    const magicHourResponse = await fetch('https://api.magichour.ai/v1/image-projects', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MAGIC_HOUR_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        style: {
          type: "Face Swap"
        },
        assets: {
          image_file_path: targetImageUrl, // foto template/target
          swap_image_file_path: finalImage // foto user dari microsite
        },
        name: `pDOOH_${userName}_${jobId}`
      })
    });

    const aiData = await magicHourResponse.json();

    if (!magicHourResponse.ok) {
      console.error('[MAGIC_HOUR_ERROR_RESPONSE]', aiData);
      throw new Error(aiData.message || JSON.stringify(aiData));
    }

    // 2. Buat Log Record
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

    // 3. Simpan Log & Job Mapping ke Redis Cloud
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