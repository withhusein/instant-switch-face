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

    // Panggil model google/nano-banana-2 via Replicate REST API
    const response = await fetch("https://api.replicate.com/v1/models/google/nano-banana-2/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt: "Swap the face in the first image with the face provided in the second image. Keep the body, lighting, background, and style of the first image intact.",
          image_input: [templateImageUrl, userImageUrl]
        }
      })
    });

    const prediction = await response.json();

    if (response.status !== 201 && response.status !== 200) {
      return res.status(response.status).json({ 
        error: prediction.detail || prediction.error || JSON.stringify(prediction) 
      });
    }

    // Polling hingga proses pembuatan gambar AI selesai
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