FROM node:22-alpine
WORKDIR /app

COPY . .
RUN npm ci && npm run build

EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "dist/main.js"]
