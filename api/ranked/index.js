// ✅ Nouveau ranked/index.js — avec filtres dynamiques complets

const fetch = require("node-fetch");

export default async function handler(req, res) {
  const { q, minVph = 0, vphRatio = 0, minViews = 0, maxResults = 10 } = req.query;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!q) {
    return res.status(400).json({ error: "Missing query parameter ?q=" });
  }

  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(q)}&key=${apiKey}`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();

  const videoIds = searchData.items.map((item) => item.id.videoId).join(",");
  const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${apiKey}`;
  const statsRes = await fetch(statsUrl);
  const statsData = await statsRes.json();

  const now = Date.now();
  const results = statsData.items.map((video) => {
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
      hoursOld: Math.round(hours),
    };
  });

  // Appliquer les filtres définis dans l’URL
  const filtered = results.filter((video) => {
    return (
      video.vph >= parseInt(minVph) &&
      video.views >= parseInt(minViews) &&
      video.vph / (video.views / video.hoursOld) >= parseFloat(vphRatio)
    );
  });

  res.status(200).json({ results: filtered });
}
