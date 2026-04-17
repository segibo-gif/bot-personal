FROM node:20-slim

# Instalar Chromium para Puppeteer (whatsapp-web.js lo necesita)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-freefont-ttf \
    fonts-noto-color-emoji \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Decirle a Puppeteer que use el Chromium del sistema (no descargue el suyo)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Carpeta de trabajo
WORKDIR /app

# Instalar dependencias primero (aprovecha caché de Docker)
COPY package.json ./
RUN npm install

# Copiar código
COPY bot.js ./

# Crear carpeta de datos (se llenará con el volume de Railway)
RUN mkdir -p datos session

CMD ["node", "bot.js"]
