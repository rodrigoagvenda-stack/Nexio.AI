FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production=false

COPY index.ts ./

ENV NODE_ENV=production

CMD ["npx", "tsx", "index.ts"]
