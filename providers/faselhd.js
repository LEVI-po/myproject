const API = "https://faselhdapi.onrender.com";
const CINEMETA = "https://v3-cinemeta.strem.io/meta";

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

function request(url) {
  return fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json,text/plain,*/*"
    }
  }).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.text();
  }).then(function (text) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return text;
    }
  });
}

function clean(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function walk(value, out) {
  if (!value) return out;

  if (Array.isArray(value)) {
    value.forEach(function (x) {
      walk(x, out);
    });
    return out;
  }

  if (typeof value === "object") {
    out.push(value);

    Object.keys(value).forEach(function (key) {
      walk(value[key], out);
    });
  }

  return out;
}

function findItems(data) {
  var objects = walk(data, []);

  return objects.filter(function (x) {
    return (
      x &&
      typeof x === "object" &&
      (
        x.id !== undefined ||
        x._id !== undefined ||
        x.videoId !== undefined ||
        x.video_id !== undefined
      )
    );
  });
}

function getId(obj) {
  if (!obj) return null;

  return (
    obj.videoId ||
    obj.video_id ||
    obj.contentId ||
    obj.content_id ||
    obj.id ||
    obj._id ||
    null
  );
}

function getTitle(obj) {
  if (!obj) return "";

  return (
    obj.title ||
    obj.name ||
    obj.original_title ||
    obj.originalTitle ||
    ""
  );
}

function chooseBest(results, title) {
  if (!results || !results.length) return null;

  var wanted = clean(title);

  var exact = results.find(function (x) {
    var t = clean(getTitle(x));
    return t && (t === wanted || t.indexOf(wanted) !== -1 || wanted.indexOf(t) !== -1);
  });

  return exact || results[0];
}

function getMetadata(tmdbId, mediaType) {
  return request(
    CINEMETA +
      "/" +
      (mediaType === "tv" ? "tv" : "movie") +
      "/" +
      encodeURIComponent(tmdbId) +
      ".json"
  );
}

function searchFasel(title) {
  return request(
    API +
      "/search?query=" +
      encodeURIComponent(title) +
      "&page=1&pageSize=20"
  );
}

function getMovie(id) {
  return request(API + "/movie/" + encodeURIComponent(id));
}

function getTV(id) {
  return request(API + "/tv/" + encodeURIComponent(id));
}

function getEpisode(id, episode) {
  return request(
    API +
      "/tv/" +
      encodeURIComponent(id) +
      "/episode/" +
      encodeURIComponent(episode)
  );
}

function getDirectLink(videoId) {
  return request(
    API +
      "/directlink?id=" +
      encodeURIComponent(videoId)
  );
}

function extractPlayableUrl(data) {
  var objects = walk(data, []);

  var candidates = [];

  objects.forEach(function (obj) {
    if (!obj || typeof obj !== "object") return;

    Object.keys(obj).forEach(function (key) {
      var value = obj[key];

      if (typeof value !== "string") return;

      if (
        /^https?:\/\//i.test(value) &&
        (
          /\.m3u8(\?|$)/i.test(value) ||
          /\.mp4(\?|$)/i.test(value) ||
          /\.mkv(\?|$)/i.test(value) ||
          /stream/i.test(key) ||
          /url/i.test(key) ||
          /link/i.test(key) ||
          /source/i.test(key)
        )
      ) {
        candidates.push(value);
      }
    });
  });

  return candidates.find(function (url) {
    return /\.m3u8(\?|$)/i.test(url);
  }) || candidates.find(function (url) {
    return /\.mp4(\?|$)/i.test(url);
  }) || candidates[0] || null;
}

function extractVideoId(data) {
  var objects = walk(data, []);

  for (var i = 0; i < objects.length; i++) {
    var obj = objects[i];

    if (!obj || typeof obj !== "object") continue;

    var id =
      obj.videoId ||
      obj.video_id ||
      obj.videoID ||
      obj.vid ||
      obj.video ||
      obj.resourceId ||
      obj.resource_id;

    if (id && typeof id !== "object") {
      return String(id);
    }
  }

  return null;
}

function makeStream(url, quality) {
  return {
    name: "FaselHD",
    title: "FaselHD " + quality,
    url: url,
    quality: quality,
    headers: {
      "User-Agent": UA,
      "Referer": "https://faselhdapi.onrender.com/"
    }
  };
}

function getStreams(tmdbId, mediaType, season, episode) {
  console.log(
    "[FaselHD] getStreams",
    tmdbId,
    mediaType,
    season,
    episode
  );

  if (!tmdbId) {
    return Promise.resolve([]);
  }

  return getMetadata(tmdbId, mediaType)
    .then(function (meta) {
      var title =
        (meta && meta.meta && (meta.meta.name || meta.meta.title)) ||
        (meta && (meta.name || meta.title));

      if (!title) {
        throw new Error("Cinemeta title not found");
      }

      console.log("[FaselHD] Searching:", title);

      return searchFasel(title).then(function (searchData) {
        return {
          title: title,
          results: findItems(searchData)
        };
      });
    })
    .then(function (ctx) {
      var item = chooseBest(ctx.results, ctx.title);

      if (!item) {
        throw new Error("FaselHD result not found");
      }

      var faselId = getId(item);

      if (!faselId) {
        throw new Error("FaselHD ID not found");
      }

      console.log("[FaselHD] Matched:", faselId);

      if (mediaType === "movie") {
        return getMovie(faselId);
      }

      return getTV(faselId).then(function (tvData) {
        return {
          tvData: tvData,
          faselId: faselId
        };
      });
    })
    .then(function (data) {
      if (mediaType === "movie") {
        var movieVideoId = extractVideoId(data);

        if (!movieVideoId) {
          movieVideoId = getId(
            findItems(data)[0]
          );
        }

        if (!movieVideoId) {
          throw new Error("Movie video ID not found");
        }

        return getDirectLink(movieVideoId);
      }

      return getEpisode(
        data.faselId,
        episode
      );
    })
    .then(function (data) {
      var videoId = extractVideoId(data);

      if (!videoId) {
        var first = findItems(data)[0];
        videoId = getId(first);
      }

      if (!videoId) {
        throw new Error("Episode video ID not found");
      }

      return getDirectLink(videoId);
    })
    .then(function (direct) {
      var url = extractPlayableUrl(direct);

      if (!url) {
        console.log("[FaselHD] No playable URL:", direct);
        return [];
      }

      var quality =
        /2160|4k/i.test(url) ? "4K" :
        /1080/i.test(url) ? "1080p" :
        /720/i.test(url) ? "720p" :
        "HD";

      console.log("[FaselHD] STREAM FOUND:", url);

      return [
        makeStream(url, quality)
      ];
    })
    .catch(function (error) {
      console.error(
        "[FaselHD] ERROR:",
        error && error.message
          ? error.message
          : String(error)
      );

      return [];
    });
}

module.exports = {
  getStreams: getStreams
};