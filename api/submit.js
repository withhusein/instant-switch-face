export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userName, userImageUrl } = req.body;

    if (!userName || !userImageUrl) {
      return res.status(400).json({ error: 'Nama dan Foto Wajah wajib diisi' });
    }

    const apiKey = process.env.MAGIC_HOUR_API_KEY ? process.env.MAGIC_HOUR_API_KEY.trim() : null;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'MAGIC_HOUR_API_KEY tidak terdeteksi di Environment Variables Vercel.' });
    }

    const templateImageUrl = "https://instant-switch-face.vercel.app/template.jpg";

    // 1. Kirim Request Face Swap ke Magic Hour API
    const response = await fetch("https://api.magichour.ai/v1/face-swap-photo", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assets: {
          image_file_path: templateImageUrl,  // Foto target/template
          face_file_path: userImageUrl       // Foto wajah user
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.message || data.error || 'Gagal dari Magic Hour API' 
      });
    }

    // 2. Polling hingga proses generasi foto di Magic Hour selesai
    const id = data.id;
    let completedResult = null;
    let attempts = 0;

    while (attempts < 30) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      const pollResponse = await fetch(`https://api.magichour.ai/v1/face-swap-photo/${id}`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });
      
      const pollData = await pollResponse.json();

      if (pollData.status === "complete") {
        completedResult = pollData;
        break;
      } else if (pollData.status === "error") {
        return res.status(500).json({ error: "Proses Face Swap gagal di Magic Hour." });
      }

      attempts++;
    }

    if (!completedResult || !completedResult.download_url) {
      return res.status(508).json({ error: "Proses memakan waktu terlalu lama (timeout)." });
    }

    return res.status(200).json({
      success: true,
      asset: {
        id: Date.now().toString(),
        userName: userName,
        url: completedResult.download_url,
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