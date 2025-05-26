const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const { q } = req.query;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!q) {
    return res.status(400).json({ error: 'Missing query parameter ?q=' });
  }

  try {
    // Étape 1 – Rechercher les vidéos
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(q)}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.items || searchData.items.length === 0) {
      return res.status(404).json({ error: 'No videos found.' });
    }

    // Étape 2 – Récupérer les IDs des vidéos
    const videoIds = searchData.items.map((item) => item.id.videoId).join(',');

    // Étape 3 – Récupérer les stats
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${apiKey}`;
    const statsRes = await fetch(statsUrl);
    const statsData = await statsRes.json();

    const now = Date.now();

    const results = statsData.items.map((video) => {
      const publishedAt = new Date(video.snippet.publishedAt).getTime();
      const hours = (now - publishedAt) / (1000 * 60 * 60);
      const views = parseInt(video.statistics.viewCount || '0', 10);
      const vph = Math.round(views / hours);

      return {
        title: video.snippet.title,
        videoId: video.id,
        views,
        vph,
      };
    });

    // Trier par VPH décroissant
    results.sort((a, b) => b.vph - a.vph);

    res.status(200).json({ results });
  } catch (err) {
    console.error('Error fetching YouTube data:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};
