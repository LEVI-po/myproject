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
// REQUEST LOGGER
app.use((req, res, next) => {
  console.log("[REQUEST]", req.method, req.originalUrl);
  next();
});
// Home / Health check
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
// Stream endpoint
app.get("/stream/:type/:id.json", async (req, res) => {
  try {
    const type = req.params.type;
    const rawId = req.params.id;
    console.log("[STREAM] Type:", type);
    console.log("[STREAM] ID:", rawId);
    let tmdbId = rawId;
    let season = null;
    let episode = null;
    // Series: tt0944947:1:1
    if (type === "series") {
      const parts = rawId.split(":");
      tmdbId = parts[0];
      season = parts[1] ? Number(parts[1]) : null;
      episode = parts[2] ? Number(parts[2]) : null;
      console.log("[STREAM] TMDB:", tmdbId);
      console.log("[STREAM] Season:", season);
      console.log("[STREAM] Episode:", episode);
      if (!season || !episode) {
        return res.json({
          streams: []
        });
      }
    }
    const mediaType = type === "series" ? "tv" : "movie";
    console.log("[STREAM] Calling FaselHD provider...");
    const streams = await getStreams(
      tmdbId,
      mediaType,
      season,
      episode
    );
    console.log("[STREAM] Result:", streams);
    res.json({
      streams: Array.isArray(streams) ? streams : []
    });
  } catch (error) {
    console.error("[STREAM ERROR]", error);
    res.status(200).json({
      streams: [],
      error: error.message || String(error)
    });
  }
});
// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log("FaselHD Nuvio Backend running on port " + PORT);
});