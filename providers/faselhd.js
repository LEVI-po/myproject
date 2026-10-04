function getStreams(tmdbId, mediaType, season, episode) {
  console.log(
    "[FaselHD] getStreams:",
    tmdbId,
    mediaType,
    season,
    episode
  );

  // اختبار فقط:
  // نتأكد أن Nuvio يشغّل الـProvider ويستدعي getStreams.
  return Promise.resolve([
    {
      name: "FaselHD",
      title: "Provider connected - test",
      url: "https://example.com/test.m3u8",
      quality: "1080p"
    }
  ]);
}

module.exports = {
  getStreams
};