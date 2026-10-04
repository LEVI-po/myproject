const express = require("express");
const { getStreams } = require("./providers/faselhd");

const app = express();
const PORT = process.env.PORT || 10000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Safari/537.36";

const HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,*/*",
  "Accept-Language": "ar,en;q=0.8"
};

// =========================
// CORS + LOGS
// =========================

app.use((req, res, next) => {
  console.log("[REQUEST]", req.method, req.originalUrl);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");

  next();
});

// =========================
// HELPERS
// =========================

async function getHtml(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      ...HEADERS,
      ...(options.headers || {})
    },
    redirect: "follow",
    signal: AbortSignal.timeout(options.timeout || 12000)
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

function absoluteUrl(url, base) {
  if (!url) return null;

  url = decodeHtml(url.trim());

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

function htmlText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// =========================
// SEARCH RESULTS
// =========================

function findPosts(html, base) {
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
      url: absoluteUrl(m[1], base),
      poster: absoluteUrl(m[2], base),
      title: decodeHtml(m[3])
    });
  }

  return results;
}

// =========================
// EPISODES
// =========================

function findEpisodes(html, base) {
  const episodes = [];

  const re =
    /<div[^>]*class=["'][^"']*\bepAll\b[^"']*["'][\s\S]*?<\/div>/gi;

  let blockMatch;

  while ((blockMatch = re.exec(html))) {
    const block = blockMatch[0];

    const linkRe =
      /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    let linkMatch;

    while ((linkMatch = linkRe.exec(block))) {
      const name = htmlText(linkMatch[2]);
      const numberMatch = name.match(/\d+/);

      episodes.push({
        url: absoluteUrl(linkMatch[1], base),
        name,
        number: numberMatch
          ? Number(numberMatch[0])
          : null
      });
    }
  }

  return episodes;
}

// =========================
// CINEMETA
// =========================

async function getCinemeta(tmdbId, type) {
  const metaType =
    type === "movie"
      ? "movie"
      : "series";

  const url =
    `https://v3-cinemeta.strem.io/meta/` +
    `${metaType}/${encodeURIComponent(tmdbId)}.json`;

  console.log("[CINEMETA]", url);

  const response = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json"
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(
      `Cinemeta HTTP ${response.status}`
    );
  }

  return response.json();
}

// =========================
// HOME
// =========================

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "FaselHD Nuvio Backend",
    version: "3.0.0"
  });
});

// =========================
// HEALTH
// =========================

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

// =========================
// MANIFEST
// =========================

app.get("/manifest.json", (req, res) => {
  res.json({
    id: "org.leivpo.faselhd",
    version: "3.0.0",
    name: "FaselHD Nuvio",
    description:
      "FaselHD Arabic movies and TV",

    resources: [
      "catalog",
      "meta",
      "stream"
    ],

    types: [
      "movie",
      "series"
    ],

    catalogs: [
      {
        type: "movie",
        id: "faselhd-movies",
        name: "FaselHD Movies",
        extra: [
          {
            name: "search",
            isRequired: false
          }
        ]
      },

      {
        type: "series",
        id: "faselhd-series",
        name: "FaselHD Series",
        extra: [
          {
            name: "search",
            isRequired: false
          }
        ]
      }
    ],

    idPrefixes: [
      "tt",
      "tmdb"
    ]
  });
});

// =========================
// RESOLVE
// =========================
// This is the endpoint used by
// Nuvio faselhd.js
//
// Examples:
//
// /resolve/series/tt094947:1:1
// /resolve/movie/tt123456
//

app.get(
  "/resolve/:type/:id",
  async (req, res) => {
    try {
      const type =
        req.params.type;

      const id =
        decodeURIComponent(
          req.params.id
        );

      console.log(
        "==============================="
      );

      console.log(
        "[RESOLVE]"
      );

      console.log(
        "Type:",
        type
      );

      console.log(
        "ID:",
        id
      );

      // =====================
      // SERIES
      // =====================

      if (type === "series") {
        const parts =
          id.split(":");

        const tmdbId =
          parts[0];

        const season =
          Number(parts[1] || 1);

        const episode =
          Number(parts[2] || 1);

        if (
          !tmdbId ||
          !Number.isInteger(season) ||
          !Number.isInteger(episode)
        ) {
          console.log(
            "[RESOLVE] Invalid series ID"
          );

          return res.json({
            streams: []
          });
        }

        console.log(
          "[RESOLVE] TMDB:",
          tmdbId
        );

        console.log(
          "[RESOLVE] Season:",
          season
        );

        console.log(
          "[RESOLVE] Episode:",
          episode
        );

        const streams =
          await getStreams(
            tmdbId,
            "tv",
            season,
            episode
          );

        console.log(
          "[RESOLVE] Streams:",
          Array.isArray(streams)
            ? streams.length
            : 0
        );

        return res.json({
          streams:
            Array.isArray(streams)
              ? streams
              : []
        });
      }

      // =====================
      // MOVIE
      // =====================

      if (type === "movie") {
        console.log(
          "[RESOLVE] Movie:",
          id
        );

        const streams =
          await getStreams(
            id,
            "movie",
            null,
            null
          );

        console.log(
          "[RESOLVE] Streams:",
          Array.isArray(streams)
            ? streams.length
            : 0
        );

        return res.json({
          streams:
            Array.isArray(streams)
              ? streams
              : []
        });
      }

      return res.json({
        streams: []
      });

    } catch (error) {
      console.error(
        "[RESOLVE ERROR]",
        error?.message ||
          String(error)
      );

      return res.json({
        streams: []
      });
    }
  }
);

// =========================
// CATALOG
// =========================

app.get(
  "/catalog/:type/:id.json",
  async (req, res) => {
    try {
      const type =
        req.params.type;

      const search =
        req.query.search ||
        req.query.q ||
        "";

      if (!search) {
        return res.json({
          metas: []
        });
      }

      const meta =
        await getCinemeta(
          search,
          type
        );

      const item =
        meta?.meta;

      if (!item) {
        return res.json({
          metas: []
        });
      }

      return res.json({
        metas: [
          {
            id:
              item.id ||
              search,

            type:
              type === "series"
                ? "series"
                : "movie",

            name:
              item.name ||
              item.title ||
              search,

            poster:
              item.poster ||
              undefined
          }
        ]
      });

    } catch (error) {
      console.error(
        "[CATALOG ERROR]",
        error
      );

      return res.json({
        metas: []
      });
    }
  }
);

// =========================
// META
// =========================

app.get(
  "/meta/:type/:id.json",
  async (req, res) => {
    try {
      const type =
        req.params.type;

      const id =
        decodeURIComponent(
          req.params.id
        );

      console.log(
        "[META]",
        type,
        id
      );

      // If this is a TMDB/IMDb ID,
      // use Cinemeta directly.

      if (
        /^tt\d+$/i.test(id) ||
        /^\d+$/.test(id)
      ) {
        const tmdbId =
          id.replace(/^tmdb:/i, "");

        const meta =
          await getCinemeta(
            tmdbId,
            type
          );

        return res.json(
          meta
        );
      }

      // Otherwise treat it as a
      // FaselHD page URL.

      if (
        !/^https?:\/\//i.test(id)
      ) {
        return res.json({
          meta: {
            id,
            type,
            name: "FaselHD",
            videos: []
          }
        });
      }

      const html =
        await getHtml(id);

      const episodes =
        findEpisodes(
          html,
          id
        );

      const titleMatch =
        /<title[^>]*>([\s\S]*?)<\/title>/i.exec(
          html
        );

      const title =
        titleMatch
          ? htmlText(titleMatch[1])
          : "FaselHD";

      if (type !== "series") {
        return res.json({
          meta: {
            id,
            type: "movie",
            name: title,
            videos: []
          }
        });
      }

      const videos =
        episodes.map(
          (ep, index) => ({
            id:
              ep.url ||
              `${id}|episode|${index + 1}`,

            title:
              ep.name ||
              `Episode ${index + 1}`,

            season: 1,

            episode:
              ep.number ||
              index + 1,

            overview: ""
          })
        );

      return res.json({
        meta: {
          id,
          type: "series",
          name: title,
          videos
        }
      });

    } catch (error) {
      console.error(
        "[META ERROR]",
        error
      );

      return res.json({
        meta: {
          id: req.params.id,
          type: req.params.type,
          name: "FaselHD",
          videos: []
        }
      });
    }
  }
);

// =========================
// OLD STREAM ENDPOINT
// =========================
// Kept for compatibility.
//
// It now uses the SAME extractor,
// so there is no recursive call.
//

app.get(
  "/stream/:type/:id.json",
  async (req, res) => {
    try {
      const type =
        req.params.type;

      const id =
        decodeURIComponent(
          req.params.id
        );

      let tmdbId = id;
      let season = null;
      let episode = null;

      if (type === "series") {
        const parts =
          id.split(":");

        tmdbId =
          parts[0];

        season =
          Number(parts[1] || 1);

        episode =
          Number(parts[2] || 1);
      }

      const streams =
        await getStreams(
          tmdbId,
          type === "series"
            ? "tv"
            : "movie",
          season,
          episode
        );

      return res.json({
        streams:
          Array.isArray(streams)
            ? streams
            : []
      });

    } catch (error) {
      console.error(
        "[STREAM ERROR]",
        error
      );

      return res.json({
        streams: []
      });
    }
  }
);

// =========================
// TEST FASELHD DOMAINS
// =========================

app.get(
  "/test-fasel",
  async (req, res) => {
    const sites = [
      "https://www.faselhds.biz/",
      "https://faselhd.club/",
      "https://faselhd.cloud/"
    ];

    const results =
      await Promise.all(
        sites.map(
          async (url) => {
            const start =
              Date.now();

            try {
              const response =
                await fetch(
                  url,
                  {
                    headers: HEADERS,
                    redirect:
                      "follow",

                    signal:
                      AbortSignal.timeout(
                        8000
                      )
                  }
                );

              const html =
                await response.text();

              return {
                url,

                status: "ok",

                http:
                  response.status,

                finalUrl:
                  response.url,

                length:
                  html.length,

                timeMs:
                  Date.now() -
                  start,

                challenge:
                  /Just a moment|cf-chl|challenge-platform/i.test(
                    html
                  )
              };

            } catch (error) {
              return {
                url,

                status: "error",

                name:
                  error?.name,

                message:
                  error?.message,

                timeMs:
                  Date.now() -
                  start
              };
            }
          }
        )
      );

    return res.json({
      tested:
        results.length,

      results
    });
  }
);

// =========================
// START
// =========================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "FaselHD Nuvio Backend running on port " +
        PORT
    );
  }
);