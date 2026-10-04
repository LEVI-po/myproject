const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const { getStreams } = require("./providers/faselhd");

const manifest = {
  id: "org.leivpo.faselhd",
  version: "1.0.2",
  name: "FaselHD Nuvio",
  description: "FaselHD Arabic movies and TV",
  resources: ["stream"],
  types: ["movie", "series"],
  catalogs: [],
  idPrefixes: ["tt"]
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async (args) => {
  try {
    console.log("Stream request:", args);

    const type = args.type;
    const id = args.id;

    if (!id) {
      return { streams: [] };
    }

    // Stremio sends series IDs like:
    // tt1234567:1:2
    let tmdbId = id;
    let season = null;
    let episode = null;

    if (type === "series") {
      const parts = id.split(":");

      tmdbId = parts[0];
      season = parts[1] ? Number(parts[1]) : null;
      episode = parts[2] ? Number(parts[2]) : null;
    }

    console.log("Resolved:", {
      type,
      tmdbId,
      season,
      episode
    });

    const streams = await getStreams(
      tmdbId,
      type === "series" ? "tv" : "movie",
      season,
      episode
    );

    console.log("Streams found:", streams?.length || 0);

    return {
      streams: Array.isArray(streams) ? streams : []
    };

  } catch (error) {
    console.error("Stream handler error:", error);

    return {
      streams: []
    };
  }
});

// IMPORTANT:
// serveHTTP must receive builder.getInterface()
serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});