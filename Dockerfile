FROM node:18-alpine

# Install system dependencies needed for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install backend dependencies with production flag to reduce size
RUN npm ci --only=production --no-audit --no-fund

# Install frontend dependencies
WORKDIR /app/frontend
RUN npm ci --no-audit --no-fund

# Copy source code
WORKDIR /app
COPY . .

# Install dev dependencies needed for build
RUN npm install typescript --no-audit --no-fund

# Build frontend first
WORKDIR /app/frontend
RUN npm run build

# Build backend
WORKDIR /app
RUN npm run build

# Clean up to reduce image size
RUN npm prune --production
WORKDIR /app/frontend
RUN rm -rf node_modules
WORKDIR /app
RUN rm -rf src frontend/src

# Expose port (PORT will be set at runtime by Koyeb)
EXPOSE 3000

# Start application using PORT environment variable
CMD ["node", "dist/server.js"]