FROM node:20.18.1
WORKDIR /app
COPY package*.json ./
# pg installed --no-save: lockfile predates the node-postgres driver switch (server/db.ts)
RUN npm ci && npm install --no-save pg@^8
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 5000
CMD ["node","dist/index.js"]
