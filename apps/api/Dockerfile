FROM node:24.18.0-bookworm-slim AS build
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install
COPY apps/api apps/api
COPY db db
COPY samples samples
RUN npm run build -w @heatmap/api

FROM node:24.18.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/db ./db
COPY --from=build /app/samples ./samples
CMD ["sh", "-c", "node apps/api/dist/db/migrate.js && node apps/api/dist/db/seed.js && node apps/api/dist/server.js"]
