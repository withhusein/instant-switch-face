import Replicate from "replicate";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userName, userImageUrl } = req.body;

    if (!userName || !userImageUrl) {
      return res.status(400).json({ error: 'Nama dan Foto Wajah wajib diisi' });
    }

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      return res.status(500).json({ error: 'REPLICATE_API_TOKEN belum diatur di Vercel!' });
    }

    const replicate = new Replicate({
      auth: replicateToken,
    });

    const templateImageUrl = "https://instant-switch-face.vercel.app/template.jpg";

    // Gunakan format nama model langsung yang stabil
    const output = await replicate.run(
      "lucataco/faceswap",
      {
        input: {
          target_image: templateImageUrl,
          swap_image: userImageUrl
        }
      }
    );

    const outputImageUrl = Array.isArray(output) ? output[0] : output;

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
    console.error("Replicate Error:", error);
    return res.status(500).json({ 
      error: error.message || 'Gagal memproses AI Face Swap' 
    });
  }
}