FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src/ ./src/

RUN mkdir -p /app/sessions

EXPOSE 3100

CMD ["node", "src/index.js"]
