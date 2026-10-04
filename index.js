const express = require("express");
const { getStreams } = require("./providers/faselhd");

const app = express();

const PORT = process.env.PORT || 7000;

const manifest = {
  id: "org.leivpo.faselhd",
  version: "1.0.3",
  name: "FaselHD Nuvio",
  description: "FaselHD Arabic movies and TV",
  resources: ["stream"],
  types: ["movie", "series"],
  catalogs: [],
  idPrefixes: ["tt"]
};

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  next();
});

// Manifest
app.get("/manifest.json", (req, res) => {
  res.json(manifest);
});

// Stream endpoint
app.get("/stream/:type/:id.json", async (req, res) => {
  try {
    const type = req.params.type;
    const rawId = req.params.id;

    console.log("=================================");
    console.log("Stream request");
    console.log("Type:", type);
    console.log("ID:", rawId);

    let tmdbId = rawId;
    let season = null;
    let episode = null;

    // Series IDs may arrive as:
    // tt1234567:1:2
    if (type === "series") {
      const parts = rawId.split(":");

      tmdbId = parts[0];
      season = parts[1] ? Number(parts[1]) : null;
      episode = parts[2] ? Number(parts[2]) : null;
    }

    console.log("TMDB ID:", tmdbId);
    console.log("Season:", season);
    console.log("Episode:", episode);

    const streams = await getStreams(
      tmdbId,
      type === "series" ? "tv" : "movie",
      season,
      episode
    );

    console.log("Streams:", streams);

    res.json({
      streams: Array.isArray(streams) ? streams : []
    });

  } catch (error) {
    console.error("STREAM ERROR:", error);

    res.json({
      streams: []
    });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "FaselHD Nuvio Backend"
  });
});

app.listen(PORT, () => {
  console.log(`FaselHD Nuvio running on port ${PORT}`);
});