// server.js
// Jireh Sports Management — Main Backend Server

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { startAllCronJobs } = require("./services/cronService");

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",  // fallback for CRA
    "http://127.0.0.1:3000",
  ].filter(Boolean),
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from frontend build (production)
let distPath = path.join(__dirname, "./public");
if (!fs.existsSync(distPath)) {
  distPath = path.join(__dirname, "../../jireh-app/dist");
}
app.use(express.static(distPath));

// Request logger (dev only)
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ============================================================
// ROUTES
// ============================================================
app.use("/api/auth",    require("./routes/auth"));
app.use("/api/players", require("./routes/players"));
app.use("/api/admin",   require("./routes/admin"));
app.use("/api/public",  require("./routes/public"));
app.use("/api/pharmacy", require("./routes/pharmacy"));
app.use("/api/coach", require("./routes/coachAssessment"));

// ============================================================
// HEALTH CHECK
// ============================================================
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    service: "Jireh Sports Management API",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ============================================================
// CATCH-ALL FOR SPA ROUTING
// Serve index.html for any route that's not an API route
// ============================================================
app.get("*", (req, res) => {
  // Only serve index.html for non-API routes
  if (!req.path.startsWith("/api")) {
    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: "Frontend not found. Copy frontend/dist to backend/public folder." });
    }
  } else {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
  }
});

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error." });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT,"0.0.0.0", () => {
  console.log(`\n🚀 Jireh Sports API running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}\n`);

  // Start automated background jobs
  startAllCronJobs();
});

module.exports = app;
