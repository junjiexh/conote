FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js snapshotWorker.js ./
COPY lib ./lib
COPY proto ./proto
ENV COLLAB_SERVER_PORT=1234
EXPOSE 1234
CMD ["sh", "-c", "node snapshotWorker.js & exec node server.js"]
