export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userName, userImageUrl } = req.body;

    if (!userName || !userImageUrl) {
      return res.status(400).json({ error: 'Nama dan Foto Wajah wajib diisi' });
    }

    const token = process.env.REPLICATE_API_TOKEN ? process.env.REPLICATE_API_TOKEN.trim() : null;
    
    if (!token) {
      return res.status(500).json({ error: 'REPLICATE_API_TOKEN tidak terdeteksi di Environment Variables Vercel.' });
    }

    const templateImageUrl = "https://instant-switch-face.vercel.app/template.jpg";

    // 1. Kirim Request Prediksi ke Replicate API
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "4f9011562784d81203eb615e4f20f04eefeb21a84f3ebf2dcfedfd17b075c3db",
        input: {
          target_image: templateImageUrl,
          swap_image: userImageUrl
        }
      })
    });

    const prediction = await response.json();

    if (response.status !== 201 && response.status !== 200) {
      return res.status(response.status).json({ 
        error: prediction.detail || prediction.error || 'Gagal dari Replicate API' 
      });
    }

    // 2. Poll / Tunggu Hasil Eksekusi Selesai
    let completedPrediction = prediction;
    while (
      completedPrediction.status !== "succeeded" && 
      completedPrediction.status !== "failed"
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const resPoll = await fetch(completedPrediction.urls.get, {
        headers: {
          "Authorization": `Token ${token}`,
        },
      });
      completedPrediction = await resPoll.json();
    }

    if (completedPrediction.status === "failed") {
      return res.status(500).json({ error: "Proses AI Face Swap gagal dieksekusi oleh model." });
    }

    const outputImageUrl = Array.isArray(completedPrediction.output) 
      ? completedPrediction.output[0] 
      : completedPrediction.output;

    return res.status(200).json({
      success: true,
      asset: {
        id: Date.now().toString(),
        userName: userName,
        url: outputImageUrl,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ 
      error: error.message || 'Gagal memproses request' 
    });
  }
}