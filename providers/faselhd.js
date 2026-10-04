const BASE = "https://faselhd.cloud";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/140.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ar,en;q=0.8"
};

async function getHtml(url) {
  const response = await fetch(url, {
    headers: HEADERS,
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`FaselHD HTTP ${response.status}`);
  }

  return response.text();
}

function absoluteUrl(url) {
  if (!url) return null;

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith("//")) {
    return "https:" + url;
  }

  if (url.startsWith("/")) {
    return BASE + url;
  }

  return BASE + "/" + url;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

// =========================
// TMDB / CINEMETA
// =========================

async function getCinemeta(type, id) {
  const url =
    `https://v3-cinemeta.strem.io/meta/${type}/${id}.json`;

  console.log("[FaselHD] Cinemeta:", url);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Cinemeta HTTP ${response.status}`
    );
  }

  const data = await response.json();

  return data && data.meta
    ? data.meta
    : null;
}

// =========================
// SEARCH FASELHD
// =========================

async function searchFasel(title) {
  const url =
    BASE +
    "/?s=" +
    encodeURIComponent(title).replace(
      /%20/g,
      "+"
    );

  console.log("[FaselHD] Search:", url);

  const html = await getHtml(url);

  const results = [];

  const re =
    /<div[^>]*class=["'][^"']*\bpostDiv\b[^"']*["'][\s\S]*?<\/div>\s*<\/div>/gi;

  let match;

  while ((match = re.exec(html))) {
    const block = match[0];

    const m =
      /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*alt=["']([^"']*)["']/i.exec(
        block
      );

    if (!m) continue;

    results.push({
      url: absoluteUrl(
        decodeHtml(m[1])
      ),
      poster: absoluteUrl(
        decodeHtml(m[2])
      ),
      title: decodeHtml(m[3])
    });
  }

  console.log(
    "[FaselHD] Search results:",
    results.length
  );

  return results;
}

// =========================
// FIND EPISODE
// =========================

async function findEpisode(
  pageUrl,
  season,
  episode
) {
  const html =
    await getHtml(pageUrl);

  const re =
    /<div[^>]*class=["'][^"']*\bepAll\b[^"']*["'][\s\S]*?<\/div>/gi;

  let blockMatch;

  while ((blockMatch = re.exec(html))) {
    const block = blockMatch[0];

    const linkRe =
      /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    let linkMatch;

    while (
      (linkMatch = linkRe.exec(block))
    ) {
      const name =
        linkMatch[2]
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      const numberMatch =
        name.match(/\d+/);

      const number =
        numberMatch
          ? Number(numberMatch[0])
          : null;

      if (
        number === Number(episode)
      ) {
        return absoluteUrl(
          decodeHtml(linkMatch[1])
        );
      }
    }
  }

  return null;
}

// =========================
// GET STREAMS
// =========================

async function getStreams(
  tmdbId,
  mediaType,
  season,
  episode
) {
  try {
    if (!tmdbId) {
      return [];
    }

    const type =
      mediaType === "tv" ||
      mediaType === "series"
        ? "series"
        : "movie";

    const meta =
      await getCinemeta(
        type,
        tmdbId
      );

    if (!meta || !meta.name) {
      console.log(
        "[FaselHD] No Cinemeta metadata"
      );

      return [];
    }

    console.log(
      "[FaselHD] Title:",
      meta.name
    );

    const results =
      await searchFasel(
        meta.name
      );

    if (!results.length) {
      return [];
    }

    const first =
      results[0];

    console.log(
      "[FaselHD] Selected:",
      first.url
    );

    // فيلم
    if (type === "movie") {
      return [];
    }

    // مسلسل
    if (
      season === null ||
      season === undefined ||
      episode === null ||
      episode === undefined
    ) {
      return [];
    }

    const episodeUrl =
      await findEpisode(
        first.url,
        season,
        episode
      );

    if (!episodeUrl) {
      console.log(
        "[FaselHD] Episode not found"
      );

      return [];
    }

    console.log(
      "[FaselHD] Episode URL:",
      episodeUrl
    );

    const episodeHtml =
      await getHtml(
        episodeUrl
      );

    const streams = [];

    // iframe
    const iframeMatches =
      episodeHtml.matchAll(
        /<iframe[^>]+(?:src|data-src)=["']([^"']+)["']/gi
      );

    for (
      const match of iframeMatches
    ) {
      const iframe =
        absoluteUrl(
          decodeHtml(match[1])
        );

      if (!iframe) continue;

      streams.push({
        name: "FaselHD",
        title: "FaselHD",
        url: iframe,
        quality: "HD",
        headers: HEADERS
      });
    }

    console.log(
      "[FaselHD] Found:",
      streams.length
    );

    return streams;

  } catch (error) {
    console.error(
      "[FaselHD ERROR]",
      error.message ||
        String(error)
    );

    return [];
  }
}

module.exports = {
  getStreams
};