FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache git docker-cli docker-cli-buildx
COPY --from=build /app /app
RUN chmod +x scripts/entrypoint.sh
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["./scripts/entrypoint.sh"]
