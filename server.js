const express = require("express");
const { getStreams } = require("./providers/faselhd");

const app = express();
const PORT = process.env.PORT || 3000;

const manifest = {
  id: "org.leivpo.faselhd",
  version: "1.0.1",
  name: "FaselHD Nuvio",
  description: "FaselHD Arabic movies and TV",
  resources: ["stream"],
  types: ["movie", "series"],
  catalogs: [],
  idPrefixes: ["tt", "tmdb"]
};

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
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
  res.json(manifest);
});

// Streams
app.get("/stream/:type/:id.json", async (req, res) => {
  try {
    const type = req.params.type;
    const rawId = req.params.id;

    console.log("[Nuvio] Request:", type, rawId);

    let tmdbId = rawId;
    let season = null;
    let episode = null;

    if (type === "series") {
      const parts = rawId.split(":");

      tmdbId = parts[0];
      season = parts[1] ? Number(parts[1]) : null;
      episode = parts[2] ? Number(parts[2]) : null;

      if (!season || !episode) {
        return res.json({ streams: [] });
      }
    }

    const mediaType = type === "series" ? "tv" : "movie";

    const streams = await getStreams(
      tmdbId,
      mediaType,
      season,
      episode
    );

    console.log("[Nuvio] Streams:", streams.length);

    res.json({
      streams: Array.isArray(streams) ? streams : []
    });

  } catch (error) {
    console.error("[Nuvio] ERROR:", error);

    res.json({
      streams: []
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("FaselHD Nuvio Backend running on port " + PORT);
});