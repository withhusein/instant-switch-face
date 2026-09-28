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

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return res.status(500).json({ error: 'REPLICATE_API_TOKEN tidak ditemukan di Environment Variables Vercel!' });
    }

    // Inisialisasi dengan memberikan auth token secara langsung
    const replicate = new Replicate({
      auth: token.trim(),
    });

    const templateImageUrl = "https://instant-switch-face.vercel.app/template.jpg";

    // Gunakan model face-swap yang aktif & terverifikasi di Replicate
    const output = await replicate.run(
      "codeplugtech/face-swap:4f9011562784d81203eb615e4f20f04eefeb21a84f3ebf2dcfedfd17b075c3db",
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