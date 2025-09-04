FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# deps first for cache
COPY package*.json ./
RUN npm ci --omit=dev

# app source
COPY . .

# add curl for healthcheck (still root)
RUN apk add --no-cache curl

# drop root
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 5000

# healthcheck calls /health
HEALTHCHECK --interval=30s --timeout=3s --retries=3 --start-period=20s \
  CMD curl -fsS http://localhost:5000/health || exit 1

CMD ["node", "server.js"]
