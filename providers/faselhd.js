const BASE = "https://faselhd.cloud";

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ar,en;q=0.8"
};

function get(url, options) {
  return fetch(url, {
    method: "GET",
    headers: Object.assign({}, HEADERS, options && options.headers)
  }).then(function (r) {
    if (!r.ok) {
      throw new Error("HTTP " + r.status);
    }
    return r.text();
  });
}

function post(url, options) {
  return fetch(url, {
    method: "POST",
    headers: Object.assign({}, HEADERS, options && options.headers)
  }).then(function (r) {
    if (!r.ok) {
      throw new Error("HTTP " + r.status);
    }
    return r.text();
  });
}

function absoluteUrl(url) {
  if (!url) return null;

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.indexOf("//") === 0) {
    return "https:" + url;
  }

  if (url.charAt(0) === "/") {
    return BASE + url;
  }

  return BASE + "/" + url;
}

function htmlText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractAttribute(html, selectorPattern, attribute) {
  var match = selectorPattern.exec(html);
  if (!match) return null;

  var tag = match[0];

  var re = new RegExp(
    attribute + "\\s*=\\s*[\"']([^\"']+)[\"']",
    "i"
  );

  var found = re.exec(tag);

  return found ? decodeHtml(found[1]) : null;
}

function findPostLinks(html) {
  var results = [];

  var re =
    /<div[^>]*class=["'][^"']*\bpostDiv\b[^"']*["'][\s\S]*?<\/div>\s*<\/div>/gi;

  var match;

  while ((match = re.exec(html))) {
    var block = match[0];

    var hrefMatch =
      /<a[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*alt=["']([^"']*)["']/i.exec(
        block
      );

    if (!hrefMatch) continue;

    results.push({
      url: absoluteUrl(decodeHtml(hrefMatch[1])),
      poster: decodeHtml(hrefMatch[2]),
      title: decodeHtml(hrefMatch[3])
    });
  }

  return results;
}

function cleanTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(
      /الموسم الأول|برنامج|فيلم|مترجم|اون لاين|مسلسل|مشاهدة|انمي|أنمي/g,
      ""
    )
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chooseBest(items, wanted) {
  var target = cleanTitle(wanted);

  if (!items.length) return null;

  var exact = items.find(function (item) {
    var title = cleanTitle(item.title);

    return (
      title === target ||
      title.indexOf(target) !== -1 ||
      target.indexOf(title) !== -1
    );
  });

  return exact || items[0];
}

function searchFasel(title) {
  return get(
    BASE + "/?s=" + encodeURIComponent(title).replace(/%20/g, "+")
  ).then(function (html) {
    return {
      html: html,
      items: findPostLinks(html)
    };
  });
}

function extractEpisodeLinks(html) {
  var episodes = [];

  var re =
    /<div[^>]*class=["'][^"']*\bepAll\b[^"']*["'][\s\S]*?<\/div>/gi;

  var blockMatch;

  while ((blockMatch = re.exec(html))) {
    var block = blockMatch[0];

    var linkRe =
      /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    var linkMatch;

    while ((linkMatch = linkRe.exec(block))) {
      episodes.push({
        url: absoluteUrl(decodeHtml(linkMatch[1])),
        name: htmlText(linkMatch[2])
      });
    }
  }

  return episodes;
}

function getEpisodeNumber(name) {
  var match = String(name || "").match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function extractIframe(html) {
  var match =
    /<iframe[^>]+name=["']player_iframe["'][^>]+src=["']([^"']+)["']/i.exec(
      html
    );

  if (match) {
    return absoluteUrl(decodeHtml(match[1]));
  }

  match =
    /<iframe[^>]+src=["']([^"']+)["'][^>]*name=["']player_iframe["']/i.exec(
      html
    );

  return match ? absoluteUrl(decodeHtml(match[1])) : null;
}

function extractDownloadLink(html) {
  var match =
    /<[^>]*class=["'][^"']*\bdownloadLinks\b[^"']*["'][\s\S]*?<a[^>]+href=["']([^"']+)["']/i.exec(
      html
    );

  return match ? absoluteUrl(decodeHtml(match[1])) : null;
}

function extractM3u8(html) {
  var matches = [];

  var re =
    /https?:\/\/[^\s"'<>\\]+\.m3u8(?:\?[^\s"'<>\\]*)?/gi;

  var match;

  while ((match = re.exec(html))) {
    matches.push(match[0]);
  }

  if (!matches.length) {
    var escaped =
      /https?:\\\/\\\/[^\s"'<>]+?\.m3u8(?:\?[^\s"'<>\\]*)?/gi;

    while ((match = escaped.exec(html))) {
      matches.push(
        match[0]
          .replace(/\\\//g, "/")
          .replace(/\\u0026/g, "&")
      );
    }
  }

  var master = matches.find(function (url) {
    return /master\.m3u8/i.test(url);
  });

  return master || matches[0] || null;
}

function extractMp4(html) {
  var re =
    /https?:\/\/[^\s"'<>\\]+\.mp4(?:\?[^\s"'<>\\]*)?/gi;

  var match = re.exec(html);

  return match ? match[0] : null;
}

function qualityFromUrl(url) {
  if (/2160|4k/i.test(url)) return "4K";
  if (/1080/i.test(url)) return "1080p";
  if (/720/i.test(url)) return "720p";
  if (/480/i.test(url)) return "480p";
  return "HD";
}

function makeStream(url, title, referer) {
  return {
    name: "FaselHD",
    title: title || ("FaselHD " + qualityFromUrl(url)),
    url: url,
    quality: qualityFromUrl(url),
    headers: {
      "User-Agent": UA,
      "Referer": referer || BASE + "/"
    }
  };
}

function getMovieStream(pageUrl) {
  return get(pageUrl)
    .then(function (html) {
      var iframe = extractIframe(html);
      var download = extractDownloadLink(html);

      if (iframe) {
        return get(iframe)
          .then(function (iframeHtml) {
            var m3u8 = extractM3u8(iframeHtml);

            if (m3u8) {
              return [
                makeStream(
                  m3u8,
                  "FaselHD " + qualityFromUrl(m3u8),
                  pageUrl
                )
              ];
            }

            return [];
          })
          .catch(function () {
            return [];
          });
      }

      if (download) {
        return post(download, {
          headers: {
            "Referer": pageUrl
          }
        }).then(function (downloadHtml) {
          var mp4 = extractMp4(downloadHtml);

          return mp4
            ? [makeStream(mp4, "FaselHD Download", pageUrl)]
            : [];
        });
      }

      return [];
    });
}

function getTvEpisode(pageUrl, episodeNumber) {
  return get(pageUrl).then(function (html) {
    var episodes = extractEpisodeLinks(html);

    if (!episodes.length) {
      return [];
    }

    var wanted = episodes.find(function (ep) {
      return getEpisodeNumber(ep.name) === Number(episodeNumber);
    });

    if (!wanted) {
      return [];
    }

    return getMovieStream(wanted.url);
  });
}

function getStreams(tmdbId, mediaType, season, episode) {
  console.log(
    "[FaselHD] Start:",
    tmdbId,
    mediaType,
    season,
    episode
  );

  /*
   * نحتاج عنوان TMDB هنا، لذلك نستخدم Cinemeta
   * بدل الـAPI القديم faselhdapi.onrender.com.
   */

  var metaUrl =
    "https://v3-cinemeta.strem.io/meta/" +
    (mediaType === "tv" ? "tv" : "movie") +
    "/" +
    encodeURIComponent(tmdbId) +
    ".json";

  return fetch(metaUrl, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json"
    }
  })
    .then(function (r) {
      if (!r.ok) throw new Error("Cinemeta HTTP " + r.status);
      return r.json();
    })
    .then(function (meta) {
      var title =
        meta &&
        meta.meta &&
        (meta.meta.name || meta.meta.title);

      if (!title) {
        throw new Error("TMDB title not found");
      }

      console.log("[FaselHD] Search:", title);

      return searchFasel(title).then(function (result) {
        return {
          title: title,
          result: result
        };
      });
    })
    .then(function (ctx) {
      if (!ctx.result.items.length) {
        throw new Error("No FaselHD search results");
      }

      var best = chooseBest(
        ctx.result.items,
        ctx.title
      );

      if (!best || !best.url) {
        throw new Error("FaselHD match not found");
      }

      console.log(
        "[FaselHD] Matched:",
        best.title,
        best.url
      );

      if (mediaType === "movie") {
        return getMovieStream(best.url);
      }

      /*
       * load() في CloudStream يعرض الحلقات،
       * ثم loadLinks() يتعامل مع صفحة الحلقة.
       */
      return get(best.url).then(function (html) {
        var episodes = extractEpisodeLinks(html);

        if (!episodes.length) {
          throw new Error("No episodes found");
        }

        var wanted = episodes.find(function (ep) {
          return (
            getEpisodeNumber(ep.name) ===
            Number(episode)
          );
        });

        if (!wanted) {
          throw new Error(
            "Episode " + episode + " not found"
          );
        }

        console.log(
          "[FaselHD] Episode:",
          wanted.name,
          wanted.url
        );

        return getMovieStream(wanted.url);
      });
    })
    .then(function (streams) {
      console.log(
        "[FaselHD] Streams:",
        streams.length
      );

      return streams;
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