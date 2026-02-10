FROM node:20-bookworm-slim AS build

WORKDIR /app/frontend

ARG VITE_VOICE_ENABLED="false"
ENV VITE_VOICE_ENABLED=${VITE_VOICE_ENABLED}

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist/ /usr/share/nginx/html/
EXPOSE 80

