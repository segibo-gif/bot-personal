FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY bot.js ./

RUN mkdir -p datos session

CMD ["node", "bot.js"]
