const express = require("express");
const { getStreams } = require("./providers/faselhd");
const app = express();
const PORT = process.env.PORT || 7000;
const manifest = {
  id: "org.leivpo.faselhd",
  version: "1.0.4",
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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  next();
});
// Health check
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "FaselHD Nuvio",
    version: "1.0.4"
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
    console.log("========== STREAM REQUEST ==========");
    console.log("Type:", type);
    console.log("ID:", rawId);
    let tmdbId = rawId;
    let season = null;
    let episode = null;
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
    console.log("Streams found:", Array.isArray(streams) ? streams.length : 0);
    res.json({
      streams: Array.isArray(streams) ? streams : []
    });
  } catch (error) {
    console.error("STREAM ERROR:", error);
    res.status(200).json({
      streams: []
    });
  }
});
app.listen(PORT, () => {
  console.log(`FaselHD Nuvio running on port ${PORT}`);
  console.log(`Port: ${PORT}`);
});