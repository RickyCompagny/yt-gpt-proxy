import fetch from 'node-fetch';

// ✅ Parse un template de filtres (checklist) en objet JS
function parseFilterTemplate(template) {
  const filters = {};

  if (template.includes("Âge de la chaîne : 1–3 mois")) filters.age = "<=3";
  if (template.includes("Âge de la chaîne : 3–6 mois")) filters.age = "3-6";
  if (template.includes("Âge de la chaîne : 6–12 mois")) filters.age = "6-12";
  if (template.includes("Âge de la chaîne : > 1 an")) filters.age = ">12";

  if (template.includes("Abonnés : < 500")) filters.subscribers = 500;
  if (template.includes("Abonnés : < 2 000")) filters.subscribers = 2000;
  if (template.includes("Abonnés : < 10 000")) filters.subscribers = 10000;

  if (template.includes("Total de vidéos : < 10")) filters.totalVideos = 10;
  if (template.includes("Total de vidéos : < 30")) filters.totalVideos = 30;
  if (template.includes("Total de vidéos : < 50")) filters.totalVideos = 50;

  if (template.includes("VPH : ≥ 130")) filters.minVph = 130;
  if (template.includes("VPH : ≥ 300")) filters.minVph = 300;
  if (template.includes("VPH : ≥ 500")) filters.minVph = 500;

  if (template.includes("Vues mensuelles : > 100 000")) filters.monthlyViews = 100000;
  if (template.includes("Vues mensuelles : > 500 000")) filters.monthlyViews = 500000;

  if (template.includes("Multiplicateur VPH : ≥ 10×")) filters.vphRatio = 10;
  if (template.includes("Multiplicateur VPH : ≥ 20×")) filters.vphRatio = 20;

  if (template.includes("Engagement (%) : ≥ 4 %")) filters.engagement = 4;
  if (template.includes("Engagement (%) : ≥ 10 %")) filters.engagement = 10;

  if (template.includes("Durée : 6–20 min")) filters.duration = "6-20";
  if (template.includes("Durée : 20–60 min")) filters.duration = "20-60";

  if (template.includes("RPM : > 10 €")) filters.rpm = 10;

  if (template.includes("Pays : FR")) filters.regionCode = "FR";
  if (template.includes("Pays : CA")) filters.regionCode = "CA";
  if (template.includes("Pays : US")) filters.regionCode = "US";

  if (template.includes("Langue : fr")) filters.hl = "fr";
  if (template.includes("Langue : en")) filters.hl = "en";

  return filters;
}

// 🔍 Analyse la requête naturelle si pas de template
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

  if (query.includes("peu importe")) filters.theme = '';
  else filters.theme = raw;

  if (query.includes("récemment")) filters.recentOnly = true;
  if (query.includes("très virales")) {
    filters.minVph = 300;
    filters.minViews = 200000;
  }

  if (query.includes("france")) { filters.hl = "fr"; filters.regionCode = "FR"; }
  if (query.includes("canada")) { filters.hl = "fr"; filters.regionCode = "CA"; }
  if (query.includes("usa") || query.includes("états-unis")) { filters.hl = "en"; filters.regionCode = "US"; }
  if (query.includes("inde")) { filters.hl = "en"; filters.regionCode = "IN"; }
  if (query.includes("espagne")) { filters.hl = "es"; filters.regionCode = "ES"; }

  return filters;
}

export default async function handler(req, res) {
  const { q, template } = req.query;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!q) return res.status(400).json({ error: 'Missing query parameter ?q=' });

  try {
    const filters = template ? parseFilterTemplate(template) : analyzeQuery(q);
    const queryText = filters.theme || 'trending';

    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=50&q=${encodeURIComponent(queryText)}&regionCode=${filters.regionCode}&relevanceLanguage=${filters.hl}&key=${apiKey}`;
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
        language: filters.hl,
        country: filters.regionCode
      };
    });

    results = results.filter(video => {
      const recentOk = !filters.recentOnly || (now - video.publishedAt) < 1000 * 60 * 60 * 24 * 7;
      return video.vph >= (filters.minVph || 0)
          && video.views >= (filters.minViews || 0)
          && recentOk;
    });

    res.status(200).json({ results });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
