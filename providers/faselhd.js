const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Safari/537.36";

const SITES = [
  "https://www.faselhds.biz",
  "https://faselhd.club"
];

const TIMEOUT = 15000;

async function fetchText(url, options = {}) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "User-Agent": UA,
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        ...(options.headers || {})
      },
      signal: controller.signal
    });

    const text = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      text
    };
  } finally {
    clearTimeout(timer);
  }
}

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(text) {
  return decodeHtml(
    text
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(
      /الموسم الأول|الموسم الثاني|الموسم الثالث|الموسم الرابع|الموسم الخامس|مسلسل|فيلم|مترجم|اون لاين|مشاهدة|انمي|أنمي/g,
      " "
    )
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(base, value) {
  if (!value) return "";

  try {
    return new URL(value, base).href;
  } catch {
    return "";
  }
}

function findCards(html, base) {
  const cards = [];

  const regex =
    /<div[^>]*class=["'][^"']*postDiv[^"']*["'][\s\S]*?<\/div>\s*<\/div>/gi;

  const matches = html.match(regex) || [];

  for (const card of matches) {
    const linkMatch =
      card.match(/<a[^>]+href=["']([^"']+)["']/i);

    if (!linkMatch) continue;

    const href = absoluteUrl(
      base,
      decodeHtml(linkMatch[1])
    );

    if (!href) continue;

    const imgMatch =
      card.match(
        /<img[^>]+(?:alt|data-src|src)=["']([^"']+)["']/i
      );

    const title =
      imgMatch
        ? stripHtml(imgMatch[1])
        : stripHtml(card);

    cards.push({
      url: href,
      title
    });
  }

  return cards;
}

async function getCinemeta(tmdbId, type) {
  const kind =
    type === "movie"
      ? "movie"
      : "tv";

  const url =
    `https://v3-cinemeta.strem.io/meta/${kind}/${encodeURIComponent(tmdbId)}.json`;

  const result =
    await fetchText(url);

  if (!result.ok) {
    throw new Error(
      `Cinemeta HTTP ${result.status}`
    );
  }

  return JSON.parse(result.text);
}

async function searchFasel(title) {
  const query =
    encodeURIComponent(title);

  for (const site of SITES) {
    try {
      const url =
        `${site}/?s=${query}`;

      console.log(
        "[FaselHD] Search:",
        url
      );

      const result =
        await fetchText(url);

      console.log(
        "[FaselHD] Search HTTP:",
        result.status
      );

      if (!result.ok) continue;

      if (
        result.text.includes(
          "Just a moment..."
        )
      ) {
        console.log(
          "[FaselHD] Cloudflare:",
          site
        );
        continue;
      }

      const cards =
        findCards(
          result.text,
          site
        );

      if (cards.length) {
        console.log(
          "[FaselHD] Results:",
          cards.length
        );

        const wanted =
          normalize(title);

        cards.sort((a, b) => {
          const aa =
            normalize(a.title);

          const bb =
            normalize(b.title);

          const aScore =
            aa === wanted
              ? 100
              : aa.includes(wanted)
              ? 50
              : wanted.includes(aa)
              ? 30
              : 0;

          const bScore =
            bb === wanted
              ? 100
              : bb.includes(wanted)
              ? 50
              : wanted.includes(bb)
              ? 30
              : 0;

          return bScore - aScore;
        });

        return {
          site,
          card: cards[0]
        };
      }
    } catch (e) {
      console.log(
        "[FaselHD] Search error:",
        e.message
      );
    }
  }

  return null;
}

function findEpisodeUrl(
  html,
  base,
  season,
  episode
) {
  const links = [];

  const regex =
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while (
    (match = regex.exec(html))
  ) {
    const href =
      absoluteUrl(
        base,
        decodeHtml(match[1])
      );

    const text =
      stripHtml(match[2]);

    if (!href) continue;

    links.push({
      href,
      text
    });
  }

  const wanted =
    String(episode);

  const candidates =
    links.filter(x => {
      const text =
        x.text;

      const number =
        text.match(/\d+/);

      return (
        number &&
        number[0] === wanted
      );
    });

  if (candidates.length) {
    return candidates[0].href;
  }

  return null;
}

function findDownloadUrl(
  html,
  base
) {
  const match =
    html.match(
      /<[^>]*class=["'][^"']*downloadLinks[^"']*["'][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["']/i
    );

  if (!match) {
    return null;
  }

  return absoluteUrl(
    base,
    decodeHtml(match[1])
  );
}

async function resolveDownloadPage(
  url,
  site
) {
  try {
    const result =
      await fetchText(
        url,
        {
          method: "POST",
          headers: {
            Referer: site
          }
        }
      );

    if (!result.ok) {
      console.log(
        "[FaselHD] Download HTTP:",
        result.status
      );

      return null;
    }

    const match =
      result.text.match(
        /<div[^>]*class=["'][^"']*dl-link[^"']*["'][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["']/i
      );

    if (!match) {
      console.log(
        "[FaselHD] No direct link"
      );

      return null;
    }

    return absoluteUrl(
      site,
      decodeHtml(match[1])
    );
  } catch (e) {
    console.log(
      "[FaselHD] Resolve error:",
      e.message
    );

    return null;
  }
}

async function getStreams(
  tmdbId,
  mediaType,
  season,
  episode
) {
  console.log(
    "[FaselHD] =================="
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
    season,
    "Episode:",
    episode
  );

  try {
    const meta =
      await getCinemeta(
        tmdbId,
        mediaType
      );

    const title =
      meta?.meta?.name ||
      meta?.meta?.seriesInfo?.name;

    if (!title) {
      console.log(
        "[FaselHD] No Cinemeta title"
      );

      return [];
    }

    console.log(
      "[FaselHD] Title:",
      title
    );

    const found =
      await searchFasel(title);

    if (!found) {
      console.log(
        "[FaselHD] Nothing found"
      );

      return [];
    }

    console.log(
      "[FaselHD] Found:",
      found.card.title
    );

    console.log(
      "[FaselHD] URL:",
      found.card.url
    );

    const page =
      await fetchText(
        found.card.url
      );

    if (!page.ok) {
      console.log(
        "[FaselHD] Page HTTP:",
        page.status
      );

      return [];
    }

    if (
      page.text.includes(
        "Just a moment..."
      )
    ) {
      console.log(
        "[FaselHD] Page protected"
      );

      return [];
    }

    let targetUrl =
      found.card.url;

    if (
      mediaType !== "movie"
    ) {
      const episodeUrl =
        findEpisodeUrl(
          page.text,
          found.site,
          season || 1,
          episode || 1
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

      targetUrl =
        episodeUrl;
    }

    const episodePage =
      targetUrl === found.card.url
        ? page.text
        : (
            await fetchText(
              targetUrl
            )
          ).text;

    const downloadPage =
      findDownloadUrl(
        episodePage,
        found.site
      );

    if (!downloadPage) {
      console.log(
        "[FaselHD] No download page"
      );

      return [];
    }

    console.log(
      "[FaselHD] Download page:",
      downloadPage
    );

    const directUrl =
      await resolveDownloadPage(
        downloadPage,
        found.site
      );

    if (!directUrl) {
      return [];
    }

    console.log(
      "[FaselHD] DIRECT:",
      directUrl
    );

    return [
      {
        name: "FaselHD",
        title: "FaselHD",
        url: directUrl,
        quality: 1080,
        type: "video",
        behaviorHints: {
          bingeGroup: "faselhd"
        }
      }
    ];
  } catch (error) {
    console.log(
      "[FaselHD] ERROR:",
      error?.stack ||
        error?.message ||
        String(error)
    );

    return [];
  }
}

module.exports = {
  getStreams
};