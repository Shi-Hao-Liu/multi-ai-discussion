FROM node:18-slim

WORKDIR /app

# Copy package files for both backend and frontend
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install backend dependencies (including dev dependencies for build)
RUN npm ci

# Install frontend dependencies and build
WORKDIR /app/frontend
RUN npm ci
RUN npm run build

# Go back to app root
WORKDIR /app

# Copy source code
COPY . .

# Build the backend
RUN npm run build

# Clean up dev dependencies to reduce image size
RUN npm ci --only=production && npm cache clean --force

# Expose port (PORT will be set at runtime by Koyeb)
EXPOSE 3000

# Start application using PORT environment variable
# Use shell form (sh -c) to ensure environment variable expansion
CMD sh -c "node dist/server.js"