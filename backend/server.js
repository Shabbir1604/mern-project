import express from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import helmet from "helmet";
import morgan from "morgan";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import client from "prom-client";

import { connectDB } from "./config/db.js";
import productRoutes from "./routes/product.route.js";
// Node 20+ allows JSON import with assert
import pkg from "./package.json" assert { type: "json" };

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Proper __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Behind reverse proxies (nginx) for correct IPs / secure cookies
app.set("trust proxy", 1);

// ---------- Security, compression, CORS, logging ----------
app.use(helmet());          // security headers
app.use(compression());     // gzip responses

// CORS whitelist (Nginx on 3000; Vite on 5173 in dev)
const whitelist = new Set([
  process.env.CLIENT_ORIGIN || "http://localhost:3000",
  "http://localhost:5173",
]);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || whitelist.has(origin)) return cb(null, true);
    return cb(null, false); // silently block unknown origins (no CORS headers)
  },
  credentials: true,
}));

// Request logs, skip noisy endpoints
app.use(morgan(process.env.NODE_ENV === "production" ? "tiny" : "dev", {
  skip: (req) => req.path === "/health" || req.path === "/metrics",
}));

// Parse JSON
app.use(express.json());

// Short-circuit CORS preflight so it doesn't hit rate limit
app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ---------- Prometheus metrics ----------
client.collectDefaultMetrics(); // node process metrics

const httpRequestHistogram = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

// Timing middleware
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const route = (req.route?.path || req.path || "unknown").replace(/:[^/]+/g, ":param");
    const status = String(res.statusCode);
    const method = req.method;
    const dur = Number(process.hrtime.bigint() - start) / 1e9; // seconds
    httpRequestHistogram.labels(method, route, status).observe(dur);
    httpRequestsTotal.labels(method, route, status).inc();
  });
  next();
});

// Expose /metrics (outside /api limiter/CORS is already handled)
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.send(await client.register.metrics());
});

// ---------- Rate limiting for APIs ----------
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,       // 15 min
  max: 100,                        // per-IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
  message: { error: "Too many requests, please try again later." },
});
app.use("/api", apiLimiter);

// ---------- Routes ----------
app.use("/api/products", productRoutes);

// Health endpoint for Docker healthcheck
app.get("/health", (_req, res) => res.status(200).send("ok"));

// Quick status for humans/monitors
app.get("/api/status", (_req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  const dbState = states[mongoose.connection.readyState] ?? "unknown";

  res.json({
    name: pkg.name,
    version: pkg.version,
    node: process.version,
    env: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT || 5000),
    db: dbState,
    uptime_seconds: Math.floor(process.uptime()),
    time: new Date().toISOString(),
  });
});

// Optional: serve frontend build (only if explicitly enabled + exists)
const clientDist = path.resolve(__dirname, "../frontend/dist");
if (process.env.SERVE_CLIENT === "true" && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

// ---------- 404 + error handlers ----------
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  const msg = err.message || "Internal server error";
  if (process.env.NODE_ENV !== "production") {
    console.error("Error:", err);
  }
  res.status(status).json({ error: msg });
});

// ---------- Start & graceful shutdown ----------
let server;
const startServer = async () => {
  try {
    await connectDB();
    server = app.listen(PORT, "0.0.0.0", () =>
      console.log(`✅ Server running at http://localhost:${PORT}`)
    );
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};
startServer();

const shutdown = (signal) => {
  console.log(`\n${signal} received. Closing...`);
  server?.close(async () => {
    try {
      await mongoose.connection.close(false);
      console.log("MongoDB connection closed.");
      process.exit(0);
    } catch (e) {
      console.error("Shutdown error:", e);
      process.exit(1);
    }
  });
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
