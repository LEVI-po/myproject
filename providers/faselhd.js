const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Safari/537.36";

const DOMAINS = [
  "https://www.faselhds.biz",
  "https://faselhd.club"
];

const TIMEOUT = 12000;

function timeoutSignal(ms = TIMEOUT) {
  return AbortSignal.timeout(ms);
}

async function fetchHtml(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": UA,
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ar,en;q=0.8",
      ...(options.headers || {})
    },
    redirect: "follow",
    signal: timeoutSignal(options.timeout || TIMEOUT)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;/gi, "/");
}

function absoluteUrl(value, base) {
  if (!value) return null;

  const url = decodeHtml(value.trim());

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith("//")) {
    return "https:" + url;
  }

  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

function cleanText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getCinemeta(tmdbId, mediaType) {
  const type = mediaType === "movie" ? "movie" : "series";

  const url =
    `https://v3-cinemeta.strem.io/meta/${type}/${encodeURIComponent(tmdbId)}.json`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json"
    },
    signal: timeoutSignal(10000)
  });

  if (!response.ok) {
    throw new Error(`Cinemeta HTTP ${response.status}`);
  }

  return response.json();
}

/*
 * Find FaselHD search results.
 *
 * Based on the CloudStream provider:
 * div.postDiv
 *   -> a href
 *   -> img alt
 */
function findSearchResults(html, base) {
  const results = [];

  const blockRegex =
    /<div[^>]*class=["'][^"']*\bpostDiv\b[^"']*["'][\s\S]*?<\/div>\s*<\/div>/gi;

  let match;

  while ((match = blockRegex.exec(html))) {
    const block = match[0];

    const hrefMatch =
      /<a[^>]+href=["']([^"']+)["']/i.exec(block);

    if (!hrefMatch) continue;

    const imgMatch =
      /<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*alt=["']([^"']*)["']/i.exec(
        block
      );

    if (!imgMatch) continue;

    results.push({
      url: absoluteUrl(hrefMatch[1], base),
      title: decodeHtml(imgMatch[2]),
      poster: absoluteUrl(imgMatch[1], base)
    });
  }

  return results;
}

function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreResult(resultTitle, wantedTitle) {
  const a = normalizeTitle(resultTitle);
  const b = normalizeTitle(wantedTitle);

  if (!a || !b) return 0;

  if (a === b) return 100;

  if (a.includes(b)) return 80;
  if (b.includes(a)) return 70;

  const wantedWords = new Set(b.split(" "));
  const resultWords = new Set(a.split(" "));

  let common = 0;

  for (const word of wantedWords) {
    if (word.length > 2 && resultWords.has(word)) {
      common++;
    }
  }

  return common;
}

function chooseBestResult(results, title) {
  return [...results]
    .map((item) => ({
      ...item,
      score: scoreResult(item.title, title)
    }))
    .sort((a, b) => b.score - a.score)[0] || null;
}

/*
 * Find an episode inside the series page.
 *
 * CloudStream uses:
 * div.epAll a
 */
function findEpisodeUrl(html, base, episodeNumber) {
  const blockRegex =
    /<div[^>]*class=["'][^"']*\bepAll\b[^"']*["'][\s\S]*?<\/div>/gi;

  let block;

  while ((block = blockRegex.exec(html))) {
    const content = block[0];

    const linkRegex =
      /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    let link;

    while ((link = linkRegex.exec(content))) {
      const name = cleanText(link[2]);
      const numbers = name.match(/\d+/);

      if (!numbers) continue;

      const number = Number(numbers[0]);

      if (number === episodeNumber) {
        return absoluteUrl(link[1], base);
      }
    }
  }

  return null;
}

/*
 * Extract .downloadLinks a
 *
 * This is the first stream method from the CloudStream provider.
 */
function findDownloadLink(html, base) {
  const match =
    /<div[^>]*class=["'][^"']*\bdownloadLinks\b[^"']*["'][\s\S]*?<\/div>/i.exec(
      html
    );

  if (!match) return null;

  const href =
    /<a[^>]+href=["']([^"']+)["']/i.exec(match[0]);

  if (!href) return null;

  return absoluteUrl(href[1], base);
}

/*
 * After POSTing to .downloadLinks:
 *
 * div.dl-link a
 */
function findDirectLink(html, base) {
  const block =
    /<div[^>]*class=["'][^"']*\bdl-link\b[^"']*["'][\s\S]*?<\/div>/i.exec(
      html
    );

  if (!block) return null;

  const href =
    /<a[^>]+href=["']([^"']+)["']/i.exec(block[0]);

  if (!href) return null;

  return absoluteUrl(href[1], base);
}

/*
 * iframe fallback.
 *
 * We only expose the iframe URL here.
 * We do NOT attempt to bypass Cloudflare.
 */
function findPlayerIframe(html, base) {
  const match =
    /<iframe[^>]+name=["']player_iframe["'][^>]+(?:src|data-src)=["']([^"']+)["']/i.exec(
      html
    );

  if (match) {
    return absoluteUrl(match[1], base);
  }

  const fallback =
    /<iframe[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*name=["']player_iframe["']/i.exec(
      html
    );

  return fallback
    ? absoluteUrl(fallback[1], base)
    : null;
}

async function searchSite(base, title) {
  const searchUrl =
    `${base}/?s=` +
    encodeURIComponent(title).replace(/%20/g, "+");

  console.log("[FaselHD] Search:", searchUrl);

  const html = await fetchHtml(searchUrl);

  if (/Just a moment|cf-chl|challenge-platform/i.test(html)) {
    throw new Error("Cloudflare challenge");
  }

  return findSearchResults(html, base);
}

async function getSeriesStream(base, title, season, episode) {
  const results = await searchSite(base, title);

  console.log("[FaselHD] Results:", results.length);

  if (!results.length) {
    return [];
  }

  const selected = chooseBestResult(results, title);

  if (!selected || !selected.url) {
    return [];
  }

  console.log(
    "[FaselHD] Selected:",
    selected.title,
    selected.url,
    "score:",
    selected.score
  );

  const seriesHtml = await fetchHtml(selected.url);

  if (/Just a moment|cf-chl|challenge-platform/i.test(seriesHtml)) {
    throw new Error("Cloudflare challenge");
  }

  const episodeUrl = findEpisodeUrl(
    seriesHtml,
    selected.url,
    Number(episode)
  );

  console.log("[FaselHD] Episode:", episodeUrl);

  if (!episodeUrl) {
    return [];
  }

  const episodeHtml = await fetchHtml(episodeUrl);

  if (/Just a moment|cf-chl|challenge-platform/i.test(episodeHtml)) {
    throw new Error("Cloudflare challenge");
  }

  /*
   * METHOD 1
   * .downloadLinks -> POST -> div.dl-link a
   */
  const downloadUrl = findDownloadLink(
    episodeHtml,
    episodeUrl
  );

  console.log(
    "[FaselHD] Download URL:",
    downloadUrl
  );

  if (downloadUrl) {
    try {
      const playerHtml = await fetchHtml(downloadUrl, {
        method: "POST",
        headers: {
          Referer: episodeUrl,
          Origin: new URL(episodeUrl).origin
        },
        timeout: 12000
      });

      const directLink = findDirectLink(
        playerHtml,
        downloadUrl
      );

      console.log(
        "[FaselHD] Direct:",
        directLink
      );

      if (directLink) {
        return [
          {
            name: "FaselHD",
            title: `${title} S${season}E${episode}`,
            url: directLink,
            quality: "HD",
            type: "video",
            referer: base
          }
        ];
      }
    } catch (error) {
      console.log(
        "[FaselHD] Download extraction failed:",
        error.message
      );
    }
  }

  /*
   * METHOD 2
   * Return iframe as fallback.
   *
   * Nuvio may be able to hand this to its player,
   * but Render does not execute WebView JavaScript.
   */
  const iframeUrl = findPlayerIframe(
    episodeHtml,
    episodeUrl
  );

  console.log(
    "[FaselHD] Iframe:",
    iframeUrl
  );

  if (iframeUrl) {
    return [
      {
        name: "FaselHD",
        title: `${title} S${season}E${episode}`,
        url: iframeUrl,
        quality: "HD",
        type: "video",
        referer: base
      }
    ];
  }

  return [];
}

async function getMovieStream(base, title) {
  const results = await searchSite(base, title);

  if (!results.length) {
    return [];
  }

  const selected = chooseBestResult(results, title);

  if (!selected || !selected.url) {
    return [];
  }

  const pageHtml = await fetchHtml(selected.url);

  const downloadUrl = findDownloadLink(
    pageHtml,
    selected.url
  );

  if (downloadUrl) {
    try {
      const playerHtml = await fetchHtml(downloadUrl, {
        method: "POST",
        headers: {
          Referer: selected.url,
          Origin: new URL(selected.url).origin
        }
      });

      const directLink = findDirectLink(
        playerHtml,
        downloadUrl
      );

      if (directLink) {
        return [
          {
            name: "FaselHD",
            title,
            url: directLink,
            quality: "HD",
            type: "video",
            referer: base
          }
        ];
      }
    } catch (error) {
      console.log(
        "[FaselHD] Movie download failed:",
        error.message
      );
    }
  }

  const iframeUrl = findPlayerIframe(
    pageHtml,
    selected.url
  );

  if (iframeUrl) {
    return [
      {
        name: "FaselHD",
        title,
        url: iframeUrl,
        quality: "HD",
        type: "video",
        referer: base
      }
    ];
  }

  return [];
}

async function getStreams(
  tmdbId,
  mediaType,
  season,
  episode
) {
  const started = Date.now();

  try {
    console.log(
      "[FaselHD] ==============================="
    );

    console.log(
      "[FaselHD] TMDB:",
      tmdbId
    );

    console.log(
      "[FaselHD] Type:",
      mediaType
    );

    console.log(
      "[FaselHD] Season:",
      season
    );

    console.log(
      "[FaselHD] Episode:",
      episode
    );

    const meta = await getCinemeta(
      tmdbId,
      mediaType
    );

    const title =
      meta?.meta?.name ||
      meta?.meta?.title;

    console.log(
      "[FaselHD] Title:",
      title
    );

    if (!title) {
      return [];
    }

    /*
     * Try both domains.
     *
     * If one fails, move to the next.
     */
    for (const base of DOMAINS) {
      try {
        console.log(
          "[FaselHD] Trying:",
          base
        );

        let streams = [];

        if (
          mediaType === "tv" ||
          mediaType === "series"
        ) {
          if (
            season == null ||
            episode == null
          ) {
            return [];
          }

          streams =
            await getSeriesStream(
              base,
              title,
              season,
              episode
            );
        } else {
          streams =
            await getMovieStream(
              base,
              title
            );
        }

        if (
          Array.isArray(streams) &&
          streams.length
        ) {
          console.log(
            "[FaselHD] SUCCESS:",
            streams.length,
            "streams"
          );

          console.log(
            "[FaselHD] Time:",
            Date.now() - started,
            "ms"
          );

          return streams;
        }
      } catch (error) {
        console.log(
          "[FaselHD] Domain failed:",
          base,
          error.message
        );
      }
    }

    console.log(
      "[FaselHD] No streams found"
    );

    return [];
  } catch (error) {
    console.error(
      "[FaselHD ERROR]",
      error.message
    );

    return [];
  }
}

module.exports = {
  getStreams
};