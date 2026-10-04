const express = require("express");
const { getStreams } = require("./providers/faselhd");

const app = express();
const PORT = process.env.PORT || 10000;

const BASE = "https://faselhd.cloud";

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

async function getHtml(url) {
  const response = await fetch(url, {
    headers: HEADERS,
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }

  return response.text();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
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
// FIND POSTS
// =========================

function findPosts(html) {
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
      url: absoluteUrl(decodeHtml(m[1])),
      poster: absoluteUrl(decodeHtml(m[2])),
      title: decodeHtml(m[3])
    });
  }

  return results;
}

// =========================
// FIND EPISODES
// =========================

function findEpisodes(html) {
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
        url: absoluteUrl(decodeHtml(linkMatch[1])),
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
// SEARCH
// =========================

async function searchFasel(query) {
  const url =
    BASE +
    "/?s=" +
    encodeURIComponent(query).replace(/%20/g, "+");

  console.log("[CATALOG] Search:", url);

  const html = await getHtml(url);

  return findPosts(html);
}

// =========================
// HOME
// =========================

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "FaselHD Nuvio Addon"
  });
});

// =========================
// MANIFEST
// =========================

app.get("/manifest.json", (req, res) => {
  res.json({
    id: "org.leivpo.faselhd",
    version: "2.0.2",
    name: "FaselHD Nuvio",
    description: "FaselHD Arabic movies and TV",

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
// CATALOG
// =========================

app.get(
  "/catalog/:type/:id.json",
  async (req, res) => {
    try {
      const type = req.params.type;

      const search =
        req.query.search ||
        req.query.q ||
        "";

      console.log("[CATALOG]");
      console.log("Type:", type);
      console.log("Search:", search);

      if (!search) {
        return res.json({
          metas: []
        });
      }

      const results =
        await searchFasel(search);

      const metas =
        results.slice(0, 20).map(
          (item) => ({
            id: item.url,
            type:
              type === "series"
                ? "series"
                : "movie",
            name: item.title,
            poster:
              item.poster || undefined
          })
        );

      console.log(
        "[CATALOG] Results:",
        metas.length
      );

      res.json({
        metas
      });

    } catch (error) {
      console.error(
        "[CATALOG ERROR]",
        error
      );

      res.json({
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
      const type = req.params.type;
      const id =
        decodeURIComponent(
          req.params.id
        );

      console.log("[META]");
      console.log("Type:", type);
      console.log("ID:", id);

      // إذا كان ID رابط FaselHD
      let pageUrl = id;

      if (
        !/^https?:\/\//i.test(pageUrl)
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

      console.log(
        "[META] Page:",
        pageUrl
      );

      const html =
        await getHtml(pageUrl);

      const episodes =
        findEpisodes(html);

      console.log(
        "[META] Episodes:",
        episodes.length
      );

      if (type !== "series") {
        return res.json({
          meta: {
            id,
            type: "movie",
            name: "FaselHD",
            videos: []
          }
        });
      }

      const videos =
        episodes.map(
          (ep, index) => ({
            id:
              id +
              "|episode|" +
              (ep.number ||
                index + 1),

            title:
              ep.name ||
              "Episode " +
                (ep.number ||
                  index + 1),

            season: 1,

            episode:
              ep.number ||
              index + 1,

            overview: ""
          })
        );

      res.json({
        meta: {
          id,
          type: "series",
          name: "FaselHD",
          videos
        }
      });

    } catch (error) {
      console.error(
        "[META ERROR]",
        error
      );

      res.json({
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
// STREAM
// =========================

app.get(
  "/stream/:type/:id.json",
  async (req, res) => {
    try {
      const type = req.params.type;

      const id =
        decodeURIComponent(
          req.params.id
        );

      console.log(
        "[STREAM REQUEST]"
      );

      console.log(
        "Type:",
        type
      );

      console.log(
        "ID:",
        id
      );

      let tmdbId = id;
      let season = null;
      let episode = null;

      if (type === "series") {
        const parts =
          id.split(":");

        tmdbId = parts[0];

        season =
          parts[1]
            ? Number(parts[1])
            : 1;

        episode =
          parts[2]
            ? Number(parts[2])
            : null;
      }

      console.log(
        "[STREAM] TMDB:",
        tmdbId
      );

      console.log(
        "[STREAM] Season:",
        season
      );

      console.log(
        "[STREAM] Episode:",
        episode
      );

      // مهم:
      // نستدعي المستخرج مباشرة.
      // لا يوجد طلب إلى /stream مرة ثانية.

      const streams =
        await getStreams(
          tmdbId,
          type === "series"
            ? "tv"
            : "movie",
          season,
          episode
        );

      console.log(
        "[STREAM] Found:",
        Array.isArray(streams)
          ? streams.length
          : 0
      );

      res.json({
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

      res.json({
        streams: []
      });
    }
  }
);

// =========================
// TEST FASELHD
// =========================

app.get(
  "/test-club",
  async (req, res) => {
    try {
      const response =
        await fetch(
          "https://faselhd.club/",
          {
            headers: {
              "User-Agent": UA,
              "Accept":
                "text/html,application/xhtml+xml,*/*"
            },
            redirect: "follow"
          }
        );

      const html =
        await response.text();

      res.json({
        status: "ok",
        http: response.status,
        finalUrl: response.url,
        length: html.length,

        cloudflare:
          /Just a moment|cf-chl|challenge-platform/i.test(
            html
          ),

        hasPostList:
          html.includes(
            "postList"
          ),

        hasPlayer:
          html.includes(
            "player_iframe"
          )
      });

    } catch (error) {
      console.error(
        "[TEST ERROR]",
        error
      );

      res.status(500).json({
        status: "error",
        message: String(error)
      });
    }
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
      "FaselHD Nuvio Addon running on port " +
        PORT
    );
  }
);