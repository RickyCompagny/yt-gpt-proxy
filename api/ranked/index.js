import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { q, minVph, minViews, maxAge } = req.query;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!q) {
    return res.status(400).json({ error: 'Missing query parameter ?q=' });
  }

  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q=${encodeURIComponent(q)}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.items || searchData.items.length === 0) {
      return res.status(404).json({ error: 'Aucune vidéo trouvée.' });
    }

    const videoIds = searchData.items.map((item) => item.id.videoId).join(',');
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${apiKey}`;
    const statsRes = await fetch(statsUrl);
    const statsData = await statsRes.json();

    const now = new Date();
    const results = statsData.items
      .map((video) => {
        const publishedAt = new Date(video.snippet.publishedAt);
        const hours = (now - publishedAt) / (1000 * 60 * 60);
        const views = parseInt(video.statistics.viewCount || '0', 10);
        const vph = Math.round(views / hours);

        return {
          title: video.snippet.title,
          videoId: video.id,
          views,
          vph,
          publishedAt: video.snippet.publishedAt,
          ageHours: Math.round(hours)
        };
      })
      .filter((video) => {
        if (minVph && video.vph < parseInt(minVph)) return false;
        if (minViews && video.views < parseInt(minViews)) return false;
        if (maxAge && video.ageHours > parseInt(maxAge) * 30 * 24) return false;
        return true;
      })
      .sort((a, b) => b.vph - a.vph);

    return res.status(200).json({ results });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
