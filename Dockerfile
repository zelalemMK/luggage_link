FROM node:20 AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy full project
COPY . .

# Build client (Vite) → server/public
RUN npm run build

# Build server (esbuild creates dist/index.js)
RUN npm run build:server || true