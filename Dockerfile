FROM node:18

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install all dependencies (including dev dependencies for build)
RUN npm install --no-audit --no-fund

# Install frontend dependencies
WORKDIR /app/frontend
RUN npm install --no-audit --no-fund

# Copy source code
WORKDIR /app
COPY . .

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Build backend
WORKDIR /app
RUN npm run build

# Expose port (PORT will be set at runtime by Koyeb)
EXPOSE 3000

# Start application using PORT environment variable
CMD ["node", "dist/server.js"]