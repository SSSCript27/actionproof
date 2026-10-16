FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
COPY shared ./shared
COPY public ./public
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4310 DATABASE_PATH=/data/actionproof.sqlite
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && mkdir /data && chown node:node /data
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
COPY mcp ./mcp
COPY scripts ./scripts
COPY sdk.mjs ./sdk.mjs
USER node
EXPOSE 4310
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:4310/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server/index.mjs"]
