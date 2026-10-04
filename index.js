const express = require("express");
const { getStreams } = require("./providers/faselhd");

const app = express();
const PORT = process.env.PORT || 7000;

const manifest = {
  id: "org.leivpo.faselhd",
  version: "1.0.0",
  name: "FaselHD Nuvio",
  description: "FaselHD Arabic movies and TV",
  resources: ["stream"],
  types: ["movie", "series"],
  catalogs: [],
  idPrefixes: ["tt"]
};

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  next();
});

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "FaselHD Nuvio Backend"
  });
});

app.get("/manifest.json", (req, res) => {
  res.json(manifest);
});

app.get("/stream/:type/:id.json", async (req, res) => {
  try {
    const type = req.params.type;
    const rawId = req.params.id;

    let tmdbId = rawId;
    let season = null;
    let episode = null;

    if (type === "series") {
      const parts = rawId.split(":");

      tmdbId = parts[0];
      season = Number(parts[1]);
      episode = Number(parts[2]);
    }

    const streams = await getStreams(
      tmdbId,
      type === "series" ? "tv" : "movie",
      season,
      episode
    );

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

app.listen(PORT, () => {
  console.log(`FaselHD Nuvio running on port ${PORT}`);
});