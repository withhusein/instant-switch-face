export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const t1_microsite = new Date().toISOString();

  try {
    const { userName, userImageUrl, rawSizeKB, compressedSizeKB } = req.body;

    if (!userName || !userImageUrl) {
      return res.status(400).json({ error: 'Nama dan foto wajib diisi' });
    }

    const apiKey = process.env.MAGIC_HOUR_API_KEY ? process.env.MAGIC_HOUR_API_KEY.trim() : null;
    if (!apiKey) {
      return res.status(500).json({ error: 'MAGIC_HOUR_API_KEY tidak ditemukan di Vercel Env' });
    }

    let finalImageUrl = userImageUrl;

    // Convert Base64 ke Public URL via FreeImageHost jika perlu
    if (userImageUrl.startsWith('data:image/')) {
      const base64Data = userImageUrl.split(',')[1];
      const formData = new URLSearchParams();
      formData.append('key', '6d207e02198a847aa98d0a2a901485a5');
      formData.append('action', 'upload');
      formData.append('source', base64Data);
      formData.append('format', 'json');

      const uploadRes = await fetch('https://freeimage.host/api/1/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      const uploadData = await uploadRes.json();
      if (uploadData?.image?.url) {
        finalImageUrl = uploadData.image.url;
      } else {
        return res.status(400).json({ error: 'Gagal mengonversi foto ke URL publik' });
      }
    }

    const t2_backend = new Date().toISOString();
    const templateImageUrl = "https://instant-switch-face.vercel.app/template.jpg";
    const webhookUrl = "https://instant-switch-face.vercel.app/api/webhook";

    // Kirim task ke Magic Hour
    const response = await fetch("https://api.magichour.ai/v1/face-swap-photo", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `pDOOH_${userName}_${Date.now()}`,
        webhook_url: webhookUrl,
        assets: {
          face_swap_mode: "all-faces",
          source_file_path: finalImageUrl,
          target_file_path: templateImageUrl
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.message || data.error || 'Gagal membuat task Magic Hour' 
      });
    }

    const t3_sent_ai = new Date().toISOString();
    const jobId = data.id;

    // Inisialisasi struktur telemetri log
    const logEntry = {
      jobId: jobId,
      userName: userName,
      status: 'PROCESSING_IN_AI',
      timestamps: {
        t1_microsite_uploaded: t1_microsite,
        t2_backend_received: t2_backend,
        t3_sent_to_magic_hour: t3_sent_ai,
        t4_webhook_completed: null,
        t5_player_fetched: null
      },
      assetMetrics: {
        rawUploadSizeKB: rawSizeKB || 0,
        frontendCompressedSizeKB: compressedSizeKB || 0,
        processedAssetSizeKB: null
      },
      durations: {
        aiProcessingTimeSec: null,
        totalLatencySec: null
      },
      resultUrl: null
    };

    // Simpan data awal ke sistem logs Vercel/Memory
    global.pDOOH_LOGS = global.pDOOH_LOGS || {};
    global.pDOOH_LOGS[jobId] = logEntry;

    // Respon instan ke frontend
    return res.status(200).json({
      success: true,
      message: 'Foto berhasil diterima dan dimasukkan ke antrean pDOOH',
      jobId: jobId,
      telemetry: logEntry
    });

  } catch (error) {
    console.error("Submit Error:", error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}