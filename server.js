const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0.0.0 Safari/537.36";

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "FaselHD Nuvio Backend"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

app.get("/test-source", async (req, res) => {
  try {
    const r = await fetch("https://netcore.faselhd.pro", {
      headers: {
        "User-Agent": UA,
        "Accept": "application/json,text/plain,*/*"
      }
    });

    const text = await r.text();

    res.json({
      status: "ok",
      http: r.status,
      length: text.length,
      preview: text.substring(0, 300)
    });
  } catch (e) {
    res.status(500).json({
      status: "error",
      message: String(e)
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});