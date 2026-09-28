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

    // ----------------------------------------------------------------------
    // 1. HANDLER BASE64 TO PUBLIC URL (Perbaikan Utama)
    // ----------------------------------------------------------------------
    let finalUserImageUrl = userImageUrl;

    // Jika input berupa Base64 Data URL, upload ke temporary image host
    if (userImageUrl.startsWith('data:image/')) {
      try {
        // Extract base64 murni tanpa header data:image/...;base64,
        const base64Data = userImageUrl.split(',')[1];
        
        // Upload Base64 ke FreeImageHost API untuk mendapatkan URL Publik
        const formData = new URLSearchParams();
        formData.append('key', '6d207e02198a847aa98d0a2a901485a5'); // Public API Key
        formData.append('action', 'upload');
        formData.append('source', base64Data);
        formData.append('format', 'json');

        const uploadRes = await fetch('https://freeimage.host/api/1/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        });

        const uploadData = await uploadRes.json();

        if (uploadData && uploadData.image && uploadData.image.url) {
          finalUserImageUrl = uploadData.image.url; // URL publik yang valid untuk Magic Hour
        } else {
          return res.status(400).json({ error: 'Gagal mengonversi gambar Base64 ke URL Publik.' });
        }
      } catch (uploadErr) {
        console.error('Upload Error:', uploadErr);
        return res.status(500).json({ error: 'Gagal memproses upload gambar sementara.' });
      }
    }

    // ----------------------------------------------------------------------
    // 2. KIRIM KE MAGIC HOUR API
    // ----------------------------------------------------------------------
    const templateImageUrl = "https://instant-switch-face.vercel.app/template.jpg";

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
          source_file_path: finalUserImageUrl,    // Menggunakan URL Publik yang sudah valid
          target_file_path: templateImageUrl
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: data.message || data.error || JSON.stringify(data) 
      });
    }

    // ----------------------------------------------------------------------
    // 3. POLLING STATUS HASIL SWAP
    // ----------------------------------------------------------------------
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