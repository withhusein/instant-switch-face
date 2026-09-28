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
      return res.status(500).json({ error: 'MAGIC_HOUR_API_KEY tidak terdeteksi di Environment Variables.' });
    }

    let finalUserImageUrl = userImageUrl;

    // Jika input Base64, ubah ke Public URL dulu
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
        finalUserImageUrl = uploadData.image.url;
      } else {
        return res.status(400).json({ error: 'Gagal mengonversi foto Base64.' });
      }
    }

    const templateImageUrl = "https://instant-switch-face.vercel.app/template.jpg";

    // Kirim task ke Magic Hour API
    const response = await fetch("https://api.magichour.ai/v1/face-swap-photo", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Face Swap - ${userName}`,
        assets: {
          face_swap_mode: "all-faces",
          source_file_path: finalUserImageUrl,
          target_file_path: templateImageUrl
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.message || data.error || 'Gagal mengirim tugas ke Magic Hour' 
      });
    }

    // KEMBALIKAN JOB ID SECARA INSTAN (TIDAK MENUNGGU AI SELESAI)
    return res.status(200).json({
      success: true,
      jobId: data.id,
      userName: userName
    });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}