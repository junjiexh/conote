FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js ./
ENV COLLAB_SERVER_PORT=1234
EXPOSE 1234
CMD ["node", "server.js"]
