const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "FaselHD Backend"
  });
});

app.get("/test-fasel", async (req, res) => {
  try {
    const r = await fetch("https://www.faselhd.cloud/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
      }
    });

    const html = await r.text();

    res.json({
      status: "ok",
      http: r.status,
      length: html.length,
      hasIframe: html.includes("iframe"),
      hasPlayer: html.includes("player")
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