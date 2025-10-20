# Simple Dockerfile to run the site with the optional Node.js API
# Small, production-focused image
FROM node:18-alpine AS base

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    ENABLED_VIDEO_PROVIDERS=mock

WORKDIR /app

# Copy only what we need (no build step required)
COPY index.html ./
COPY assets ./assets
COPY server.js ./
COPY package.json ./

# No dependencies are required, but keep npm available for future use
# (If you later add deps, uncomment the following line)
# RUN npm ci --only=production

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["node", "server.js"]
