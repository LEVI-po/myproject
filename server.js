const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Safari/537.36";

// CORS
app.use((req, res, next) => {
  console.log("[REQUEST]", req.method, req.originalUrl);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");

  next();
});

// Health
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "FaselHD Nuvio Backend"
  });
});

// Manifest
app.get("/manifest.json", (req, res) => {
  res.json({
    id: "org.leivpo.faselhd",
    version: "1.0.2",
    name: "FaselHD Nuvio",
    description: "FaselHD Arabic movies and TV",
    resources: ["stream"],
    types: ["movie", "series"],
    catalogs: [],
    idPrefixes: ["tt", "tmdb"]
  });
});

// Stream endpoint
app.get("/stream/:type/:id.json", async (req, res) => {
  try {
    const { type, id } = req.params;

    console.log("[STREAM]");
    console.log("Type:", type);
    console.log("ID:", id);

    res.json({
      streams: []
    });

  } catch (error) {
    console.error("[STREAM ERROR]", error);

    res.status(500).json({
      streams: []
    });
  }
});

// Test FaselHD
app.get("/test-club", async (req, res) => {
  try {
    const r = await fetch("https://faselhd.club/", {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,*/*"
      },
      redirect: "follow"
    });

    const html = await r.text();

    res.json({
      status: "ok",
      http: r.status,
      finalUrl: r.url,
      length: html.length,
      cloudflare: /Just a moment|cf-chl|challenge-platform/i.test(html),
      hasPostList: html.includes("postList"),
      hasPlayer: html.includes("player_iframe")
    });

  } catch (e) {
    res.status(500).json({
      status: "error",
      message: String(e)
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("FaselHD Nuvio Backend running on port " + PORT);
});