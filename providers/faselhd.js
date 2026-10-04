const BASE_URL = "https://www.faselhds.life";

async function fetchText(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.text();
}

function absoluteUrl(url) {
  if (!url) return null;
  return new URL(url, BASE_URL).href;
}

function cleanText(text) {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function search(query) {
  const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
  const html = await fetchText(url);

  const results = [];
  const regex =
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html))) {
    const url = absoluteUrl(match[1]);
    const title = cleanText(match[2]);

    if (!url || !title || title.length < 2) continue;

    results.push({
      title,
      url
    });
  }

  return results;
}

async function load(url) {
  const html = await fetchText(url);

  return {
    url,
    html
  };
}

async function getStreams() {
  return [];
}

module.exports = {
  search,
  load,
  getStreams
};