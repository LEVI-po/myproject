const DB_URL =
  "https://raw.githubusercontent.com/Ahmd3301/faselhd-db/main/output";

async function getDB(file) {
  const res = await fetch(`${DB_URL}/${file}.json`);

  if (!res.ok) {
    throw new Error(`DB error: ${res.status}`);
  }

  return await res.json();
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

async function search(query) {
  const db = await getDB("anime");

  const items = Array.isArray(db)
    ? db
    : Array.isArray(db.items)
      ? db.items
      : [];

  const q = normalize(query);

  return items
    .filter(item => {
      const name = normalize(item.name);
      const slug = normalize(item.slug);

      return name.includes(q) || slug.includes(q);
    })
    .slice(0, 20)
    .map(item => ({
      title: item.name,
      url: item.link || item.url,
      id: item.slug || item.id || item.link
    }));
}

async function getStreams() {
  return [];
}

module.exports = {
  search,
  getStreams
};