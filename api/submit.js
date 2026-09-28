import { fal } from "@fal-ai/client";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userName, userImageUrl } = req.body;

    if (!userName || !userImageUrl) {
      return res.status(400).json({ error: 'Nama dan Foto Wajah wajib diisi' });
    }

    // URL gambar template statis di folder public Anda
    const templateImageUrl = "https://instant-switch-face.vercel.app/template.jpg";

    // Panggil Fal.ai Face Swap API
    const result = await fal.subscribe("fal-ai/face-swap", {
      input: {
        base_image_url: templateImageUrl,
        swap_image_url: userImageUrl // Bisa berupa URL HTTP atau Base64 Data URL
      },
      logs: true,
    });

    const outputImageUrl = result.data.image.url;

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
    console.error("Fal.ai Error:", error);
    return res.status(500).json({ 
      error: error.message || 'Gagal memproses AI Face Swap' 
    });
  }
}