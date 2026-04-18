FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY bot.js ./

RUN mkdir -p datos session

# Variables inyectadas como build args desde Railway Variables
ARG GROQ_API_KEY=""
ARG PROYECTO_DIR="/app"
ARG WEBHOOK_URL=""

ENV GROQ_API_KEY=${GROQ_API_KEY}
ENV PROYECTO_DIR=${PROYECTO_DIR}
ENV WEBHOOK_URL=${WEBHOOK_URL}

CMD ["node", "bot.js"]
