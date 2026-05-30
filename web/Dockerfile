# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM node:20-alpine AS build
ARG VITE_API_BASE_URL
ARG VITE_TG_BOT_USERNAME
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_TG_BOT_USERNAME=$VITE_TG_BOT_USERNAME
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
# NO HEALTHCHECK directive — Timeweb Cloud Apps injects its own healthcheck
# based on the path you configure in the UI. Shipping a HEALTHCHECK here
# fights with that injection and leaves the deploy stuck in "starting".
