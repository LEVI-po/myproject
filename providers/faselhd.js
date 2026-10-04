const BASE_URL = "https://www.fasel-hd.cam";

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml"
    }
  });

  if (!response.ok) {
    throw new Error(`FaselHD HTTP ${response.status}`);
  }

  return await response.text();
}

function cleanText(text) {
  return String(text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function search(query) {
  const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
  const html = await fetchPage(url);

  const results = [];
  const seen = new Set();

  const regex =
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html))) {
    const url = match[1];
    const title = cleanText(match[2]);

    if (!url || !title || title.length < 2) continue;
    if (!url.includes("fasel-hd.cam")) continue;
    if (seen.has(url)) continue;

    seen.add(url);

    results.push({
      title,
      url
    });

    if (results.length >= 20) break;
  }

  return results;
}

async function getStreams() {
  return [];
}

module.exports = {
  search,
  getStreams
};