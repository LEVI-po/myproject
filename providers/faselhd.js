const BACKEND = "https://myproject-rg6v.onrender.com";

async function request(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json,text/plain,*/*"
    }
  });

  if (!response.ok) {
    throw new Error(`Backend HTTP ${response.status}`);
  }

  return response.json();
}

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    if (!tmdbId) {
      return [];
    }

    let type;
    let id;

    if (mediaType === "tv" || mediaType === "series") {
      type = "series";

      if (
        season === null ||
        season === undefined ||
        episode === null ||
        episode === undefined
      ) {
        console.log("[FaselHD] Missing season/episode");
        return [];
      }

      id = `${tmdbId}:${season}:${episode}`;
    } else {
      type = "movie";
      id = String(tmdbId);
    }

    const url =
      `${BACKEND}/stream/` +
      `${type}/` +
      encodeURIComponent(id) +
      `.json`;

    console.log("[FaselHD] Backend request:", url);

    const data = await request(url);

    if (!data || !Array.isArray(data.streams)) {
      console.log("[FaselHD] Backend returned no streams");
      return [];
    }

    return data.streams.map((stream) => ({
      name: stream.name || "FaselHD",
      title: stream.title || "FaselHD",
      url: stream.url,
      quality: stream.quality || "HD",
      headers: stream.headers || {}
    })).filter((stream) => stream.url);

  } catch (error) {
    console.error(
      "[FaselHD] Backend error:",
      error && error.message
        ? error.message
        : String(error)
    );

    return [];
  }
}

module.exports = {
  getStreams
};