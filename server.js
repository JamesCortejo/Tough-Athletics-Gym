const express = require("express");
const path = require("path");
const app = express();

// Serve your own static files
app.use(express.static(path.join(__dirname, "src", "public")));

// Serve Bootstrap from node_modules
app.use(
  "/bootstrap",
  express.static(path.join(__dirname, "node_modules", "bootstrap", "dist"))
);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "src", "public", "index.html"));
});

app.listen(3000, () => {
  console.log(`Server running at http://192.168.0.192:3000`);
});
