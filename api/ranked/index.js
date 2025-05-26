import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { q } = req.query;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!q) {
    return res.status(400).json({ error: 'Missing query parameter ?q=' });
  }

  try {
    // 🔍 Étape 1 : Recherche 50 vidéos liées à la requête
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q=${encodeURIComponent(q)}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    const videoIds = searchData.items.map(item => item.id.videoId).join(',');

    // 📊 Étape 2 : Récupération des stats
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${apiKey}`;
    const statsRes = await fetch(statsUrl);
    const statsData = await statsRes.json();

    const now = Date.now();

    // 🔎 Étape 3 : Calcul du VPH et filtrage intelligent
    const results = statsData.items
      .map(video => {
        const publishedAt = new Date(video.snippet.publishedAt).getTime();
        const hours = (now - publishedAt) / (1000 * 60 * 60); // depuis publication
        const views = parseInt(video.statistics.viewCount || '0', 10);
        const vph = Math.round(views / hours);

        return {
          title: video.snippet.title,
          videoId: video.id,
          views,
          vph,
        };
      })
      .filter(video => video.vph >= 130 && video.views >= 100000); // ✅ ton filtre ici

    return res.status(200).json({ results });
  } catch (error) {
    console.error('Erreur serveur:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
