import fetch from 'node-fetch';

// 🧠 Interprète la requête naturelle pour extraire thème, filtres et géo
function analyzeQuery(raw) {
  const query = raw.toLowerCase();

  const filters = {
    theme: '',
    minVph: 130,
    minViews: 100000,
    recentOnly: false,
    hl: 'en',
    regionCode: 'US',
  };

  // 🔎 Thème : détecté automatiquement sauf si "peu importe"
  if (query.includes("peu importe") || query.includes("n'importe")) {
    filters.theme = '';
  } else {
    filters.theme = raw;
  }

  // ⏱ Temps : vidéos récentes
  if (query.includes("récemment") || query.includes("7 jours") || query.includes("dernières vidéos")) {
    filters.recentOnly = true;
  }

  // 🔥 Vidéos très virales
  if (query.includes("très virales") || query.includes("explosent") || query.includes("buzzent")) {
    filters.minVph = 300;
    filters.minViews = 200000;
  }

  // 🌍 Langue & pays
  if (query.includes("français") || query.includes("france")) {
    filters.hl = 'fr';
    filters.regionCode = 'FR';
  } else if (query.includes("canada")) {
    filters.hl = 'fr';
    filters.regionCode = 'CA';
  } else if (query.includes("états-unis") || query.includes("usa") || query.includes("anglais")) {
    filters.hl = 'en';
    filters.regionCode = 'US';
  } else if (query.includes("inde") || query.includes("indien")) {
    filters.hl = 'en';
    filters.regionCode = 'IN';
  } else if (query.includes("espagnol") || query.includes("espagne")) {
    filters.hl = 'es';
    filters.regionCode = 'ES';
  }

  return filters;
}

export default async function handler(req, res) {
  const { q } = req.query;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!q) return res.status(400).json({ error: "Missing query parameter ?q=" });

  try {
    const filters = analyzeQuery(q);

    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q=${encodeURIComponent(filters.theme || 'trending')}&regionCode=${filters.regionCode}&relevanceLanguage=${filters.hl}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    const videoIds = searchData.items.map(item => item.id.videoId).filter(Boolean).join(',');
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${apiKey}`;
    const statsRes = await fetch(statsUrl);
    const statsData = await statsRes.json();

    const now = Date.now();

    let results = statsData.items.map(video => {
      const publishedAt = new Date(video.snippet.publishedAt).getTime();
      const hours = (now - publishedAt) / (1000 * 60 * 60);
      const views = parseInt(video.statistics.viewCount || "0", 10);
      const vph = Math.round(views / hours);

      return {
        title: video.snippet.title,
        videoId: video.id,
        views,
        vph,
        publishedAt,
        country: filters.regionCode,
        language: filters.hl,
      };
    });

    // ✅ Filtres dynamiques
    results = results.filter(video => {
      const isRecent = filters.recentOnly ? (now - video.publishedAt) < 1000 * 60 * 60 * 24 * 7 : true;
      return (
        video.vph >= filters.minVph &&
        video.views >= filters.minViews &&
        isRecent
      );
    });

    res.status(200).json({ results });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
