# Private CRM pilot image (crm.gershon.ai). Built on the VPS by install.sh.
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build \
 && npx esbuild scripts/import-streak.ts scripts/send-setup-link.ts --platform=node --packages=external --bundle --format=esm --outdir=dist/scripts
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
