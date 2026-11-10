FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.25-alpine AS api
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /mood .

FROM alpine:3.22
RUN apk add --no-cache ca-certificates && addgroup -S mood && adduser -S mood -G mood && mkdir -p /data/uploads && chown -R mood:mood /data
WORKDIR /app
COPY --from=api /mood /app/mood
COPY --from=web /web/dist /app/web
USER mood
ENV ADDR=0.0.0.0:8088 FRONTEND_DIR=/app/web UPLOAD_DIR=/data/uploads
EXPOSE 8088
CMD ["/app/mood"]
