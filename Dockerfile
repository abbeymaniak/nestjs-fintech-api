FROM node:24-alpine

WORKDIR /app

COPY package*.json .npmrc* ./

RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node","dist/main"]