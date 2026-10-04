const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
const manifest = {
  id: "org.leivpo.faselhd",
  version: "1.0.0",
  name: "FaselHD Nuvio",
  description: "FaselHD Arabic movies and TV",
  resources: ["stream"],
  types: ["movie", "series"],
  catalogs: []
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
  res.json({
    streams: []
  });
});
app.listen(PORT, "0.0.0.0", () => {
  console.log("FaselHD Nuvio running on port " + PORT);
});