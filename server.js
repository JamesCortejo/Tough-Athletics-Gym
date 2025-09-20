const express = require("express");
const path = require("path");
const authRoutes = require("./src/routes/authroutes");

const app = express();

// Serve static files (CSS, JS, images, HTML)
app.use(express.static(path.join(__dirname, "src", "public")));

// Serve Bootstrap from node_modules
app.use(
  "/bootstrap",
  express.static(path.join(__dirname, "node_modules", "bootstrap", "dist"))
);

// Use authentication routes
app.use("/", authRoutes);

// Homepage (index.html in /public)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "src/public/index.html"));
});

app.listen(3000, () => {
  console.log(`Server running at http://192.168.0.192:3000`);
});
