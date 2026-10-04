const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Safari/537.36";

// IMPORTANT:
// This must point to YOUR Render backend.
// Nuvio will call this backend.
const BACKEND_BASE =
  "https://myproject-rg6v.onrender.com";

const FETCH_TIMEOUT = 15000;

async function safeFetch(
  url,
  options = {},
  timeout = FETCH_TIMEOUT
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      timeout
    );

  try {
    const response =
      await fetch(
        url,
        {
          ...options,

          headers: {
            "User-Agent": UA,

            ...(options.headers || {})
          },

          signal:
            controller.signal
        }
      );

    return response;

  } finally {
    clearTimeout(timer);
  }
}

async function getStreams(
  tmdbId,
  mediaType,
  season,
  episode
) {
  const started =
    Date.now();

  const type =
    mediaType === "movie"
      ? "movie"
      : "series";

  let idStr;

  if (type === "movie") {
    idStr =
      String(tmdbId);
  } else {
    idStr =
      String(tmdbId) +
      ":" +
      String(season || 1) +
      ":" +
      String(episode || 1);
  }

  console.log(
    "[FaselHD] === " +
      type +
      "/" +
      idStr +
      " ==="
  );

  try {
    const url =
      BACKEND_BASE +
      "/resolve/" +
      type +
      "/" +
      idStr;

    console.log(
      "[FaselHD] Backend:",
      url
    );

    const response =
      await safeFetch(
        url
      );

    if (!response.ok) {
      console.log(
        "[FaselHD] Backend HTTP:",
        response.status
      );

      return [];
    }

    const data =
      await response.json();

    const streams =
      Array.isArray(
        data.streams
      )
        ? data.streams
        : [];

    console.log(
      "[FaselHD] Streams:",
      streams.length
    );

    console.log(
      "[FaselHD] Time:",
      Date.now() -
        started,
      "ms"
    );

    return streams;

  } catch (error) {
    console.log(
      "[FaselHD] Error:",
      error?.message ||
        String(error)
    );

    return [];
  }
}

module.exports = {
  getStreams
};