FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ git \
    && rm -rf /var/lib/apt/lists/*

COPY dashboard/package*.json ./dashboard/
COPY bot/package*.json ./bot/

RUN cd dashboard && npm install
RUN cd bot && npm install

COPY dashboard/ ./dashboard/
COPY bot/ ./bot/

RUN mkdir -p /app/data/clients

EXPOSE 3001

CMD ["node", "dashboard/api/index.js"]
