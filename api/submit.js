import { fal } from "@fal-ai/client";

// Inisialisasi Fal Client memakai Environment Variable FAL_KEY dari Vercel
fal.config({
  credentials: process.env.FAL_KEY,
});

export default async function handler(req, res) {
  // Hanya menerima HTTP POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userImageUrl, userName } = req.body;

    // Foto template baju balap (bisa diganti URL foto template Anda nanti)
    const templateImageUrl = "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&auto=format&fit=crop";

    // Panggil Model Face Swap dari Fal.ai
    const result = await fal.subscribe("fal-ai/face-swap", {
      input: {
        base_image_url: templateImageUrl, // Gambar Baju Balap/Target
        swap_image_url: userImageUrl       // Gambar Wajah Pengunjung
      },
      logs: true,
    });

    const generatedImageUrl = result.data.image.url;

    // Output data asset yang siap dikirim ke Videotron
    const newAsset = {
      id: `racer_${Date.now()}_${(userName || 'anon').replace(/\s+/g, '_')}`,
      url: generatedImageUrl,
      userName: userName,
      played: false,
      timestamp: new Date().toISOString()
    };

    return res.status(200).json({ success: true, asset: newAsset });

  } catch (error) {
    console.error("Error AI Fal.ai:", error);
    return res.status(500).json({ error: "Gagal memproses AI Face Swap", details: error.message });
  }
}