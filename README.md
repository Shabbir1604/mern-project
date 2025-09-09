# MERN Project — Productionized

Live:
- **Frontend (Vercel CDN):** https://mern-project-eft3.vercel.app
- **API (VM via Caddy):** https://3-141-187-2.sslip.io/api/status → should include `"db":"connected"`

---

## What’s Running (Architecture)

Browser (HTTPS)
│
├─ Frontend @ Vercel CDN → React (Vite build)
│ ├─ /health → static "OK" (uptime checks)
│ └─ /api/* (rewrite) → https://3-141-187-2.sslip.io/api/
*
│
└─ API @ Lightsail VM → Caddy (TLS, reverse proxy)
└─ /api/* → Express + Mongoose → MongoDB Atlas

Browser (HTTPS)
│
├─ Frontend @ Vercel CDN → React (Vite build)
│ ├─ /health → static "OK" (uptime checks)
│ └─ /api/* (rewrite) → https://3-141-187-2.sslip.io/api/
*
│
└─ API @ Lightsail VM → Caddy (TLS, reverse proxy)
└─ /api/* → Express + Mongoose → MongoDB Atlas


- **Reverse proxy:** Caddy terminates HTTPS, routes `/api` to backend, serves nothing else publicly.
- **Backend:** Node/Express, security middlewares (helmet, cors, morgan, compression, rate-limit), health & metrics.
- **Frontend:** Vite/React built to static assets; on Vercel with edge caching.
- **Database:** MongoDB Atlas (connection via `MONGO_URI`).

---

## Phase Milestones (Done ✅)

### Phase 1 — Public, reliable basics
- Dockerized **backend** and **frontend**
- Health/Status/Metrics:
  - `GET /health` → `OK`
  - `GET /api/status` → name/version/db/uptime
  - `GET /metrics` → Prometheus format
- Caddy on the VM for HTTPS + path routing
- SPA routing + gzip/caching in Nginx (frontend container)

### Phase 2 — CI/CD
- **GitHub Actions** build **Docker images** for each commit:
  - `ghcr.io/shabbir1604/mern-backend:{latest,<shortsha>}`
  - `ghcr.io/shabbir1604/mern-frontend:{latest,<shortsha>}`
- **Deploy workflow** runs **after** the build succeeds:
  - SSH to VM → `git pull`
  - `TAG=<shortsha> docker compose -f docker-compose.yml -f docker-compose.ghcr.yml pull && up -d`
  - VM does **no building**; it **pulls** the exact images by commit SHA

### Phase 3 — Frontend on CDN (Vercel)
- Frontend deployed to **Vercel** (global edge)
- `frontend/vercel.json`:
  - **rewrite:** `/api/:path*` → `https://3-141-187-2.sslip.io/api/:path*`
  - **headers:**
    - assets: `Cache-Control: public, max-age=31536000, immutable`
    - HTML `/`: `Cache-Control: no-cache`
    - `/health`: `Cache-Control: no-store`
- Backend CORS allows Vercel origin

---

## Useful URLs

- Frontend: `https://mern-project-eft3.vercel.app`
  - Health: `https://mern-project-eft3.vercel.app/health` → `OK`
- API Status: `https://3-141-187-2.sslip.io/api/status`
- API Metrics (Prometheus): `https://3-141-187-2.sslip.io/metrics` (protected only by obscurity; use carefully)

---

## CI/CD Flow (Quick)

1. **Push to `main`** → Action **Build & Push Images (GHCR)**:
   - Builds `frontend/` & `backend/` Docker images
   - Tags `latest` and `<shortsha>`; pushes to GHCR
2. On success → **Deploy to VM**:
   - SSH to VM, `git pull`
   - `TAG=<shortsha> docker compose -f docker-compose.yml -f docker-compose.ghcr.yml pull && up -d`
   - VM runs images for **that exact commit**

**Rollback**
cd ~/mern
TAG=<previous7sha> sudo docker compose -f docker-compose.yml -f docker-compose.ghcr.yml pull
TAG=<previous7sha> sudo docker compose -f docker-compose.yml -f docker-compose.ghcr.yml up -d

Repo Layout
backend/                 # Express + Mongoose
frontend/                # Vite/React app
  └─ public/health       # static "OK" for uptime checks
  └─ vercel.json         # rewrites + cache headers
docker-compose.yml       # core services (backend, frontend)
docker-compose.ghcr.yml  # override to use GHCR images (TAG support)
Caddyfile                # HTTPS + reverse proxy on the VM (not committed)
.env                     # VM runtime secrets (not committed)

Environment (VM)

~/mern/.env

NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/<dbname>?retryWrites=true&w=majority
CLIENT_ORIGIN=https://mern-project-eft3.vercel.app


Multiple allowed origins: comma-separate, e.g.
CLIENT_ORIGIN=https://mern-project-eft3.vercel.app,https://3-141-187-2.sslip.io

Operability Cheat-Sheet

Status
docker compose logs -f --tail=100 backend
docker compose logs -f --tail=100 frontend

Logs
docker compose logs -f --tail=100 backend
docker compose logs -f --tail=100 frontend

Restart only backend
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml up -d backend

Health checks
curl -s https://mern-project-eft3.vercel.app/health
curl -s https://3-141-187-2.sslip.io/api/status

Security/Hygiene

SSH key-only, password logins disabled

Backend has no public port; only Caddy is exposed (80/443)

App middlewares: helmet, cors, morgan, compression, rate limiting

GHCR images per commit (<shortsha>) → reproducible deploys/rollbacks



![image](https://github.com/user-attachments/assets/36c105b2-618f-4ae1-abb6-bacc794c4286)

<h1 align="center">Inventory Management System</h1>

## Tech Stack

**Frontend**
- React (Vite) — SPA, hashed asset builds
- Nginx (container) — serves built static files (in VM setup only)
- Vercel — global CDN + auto HTTPS + deploys

**Backend**
- Node.js + Express — REST API
- Mongoose — ODM for MongoDB
- Helmet, CORS, Compression, Morgan, Rate limiter — production middleware set

**Database**
- MongoDB Atlas — managed MongoDB cluster

**Reverse Proxy / TLS**
- Caddy — HTTPS (Let’s Encrypt), HTTP/2/3, path routing `/api → backend`

**Containers & Orchestration**
- Docker & Docker Compose — local/VM runtime
- GitHub Container Registry (GHCR) — image storage (`latest` + `<shortsha>` tags)

**CI/CD**
- GitHub Actions — build & push images, chained deploy to VM using exact commit tag

**Observability (foundation)**
- Health endpoints: `/health` (frontend), `/api/status` (backend)
- Prometheus metrics: `/metrics` (backend) — ready for Prometheus/Grafana

**Ops & Security**
- SSH key-only access to VM
- Env-configured CORS (allowlisted origins)


Author:   Shabbir1604
LinkedIn: https://www.linkedin.com/in/shabbirdudekula/

