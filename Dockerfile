FROM node:24-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# SQLite 数据文件目录，建议挂载持久化卷
VOLUME ["/app/database"]

EXPOSE 3000

CMD ["node", "server/index.js"]
