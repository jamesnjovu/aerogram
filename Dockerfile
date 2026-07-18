# syntax=docker/dockerfile:1
#
# Single image containing both apps (server + web) and all workspace deps.
# docker-compose runs two containers from this one image with different commands.

FROM node:24-bookworm-slim AS build
WORKDIR /app

# Toolchain for the native addon (bufferutil) that ws/GramJS compile during install.
# Only in the build stage — the runtime image copies the already-compiled binary.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies (dev deps included — the server runs via tsx, the web builds with Tailwind).
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
RUN npm ci

# Copy sources and build the Next.js frontend.
COPY . .
# NEXT_PUBLIC_API_URL is baked into the client bundle at build time — set it to the
# public URL the browser will use to reach the backend.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build -w @aerogram/web

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000 4000

# Default command runs the backend; docker-compose overrides it for the web service.
CMD ["npm", "run", "start:prod", "-w", "@aerogram/server"]
