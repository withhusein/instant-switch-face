export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Job ID wajib disertakan' });
  }

  const apiKey = process.env.MAGIC_HOUR_API_KEY ? process.env.MAGIC_HOUR_API_KEY.trim() : null;

  try {
    const pollResponse = await fetch(`https://api.magichour.ai/v1/face-swap-photo/${id}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    const pollData = await pollResponse.json();

    return res.status(200).json(pollData);
  } catch (error) {
    return res.status(500).json({ error: 'Gagal memeriksa status AI' });
  }
}