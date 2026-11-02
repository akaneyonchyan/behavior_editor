FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm test && node tests/gitlab-behaviors.mjs && node scripts/validate-behaviors.mjs
RUN VITE_ONLINE_PROVIDER=gitlab VITE_LIBRARY_MODE=published npm run build \
    && node scripts/build-server-validator.mjs

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=5110
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/shared ./shared
USER node
EXPOSE 5110
CMD ["node","server/cloud-preview.mjs"]
