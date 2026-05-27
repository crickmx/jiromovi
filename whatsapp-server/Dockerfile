FROM node:20

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src/ ./src/

RUN mkdir -p /app/sessions

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \n  CMD curl -f http://localhost:3100/health || exit 1

CMD ["node", "src/index.js"]
