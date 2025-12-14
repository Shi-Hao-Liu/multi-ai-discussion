FROM node:18

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install backend dependencies
RUN npm install

# Install frontend dependencies
WORKDIR /app/frontend
RUN npm install

# Copy source code
WORKDIR /app
COPY . .

# Build frontend first
WORKDIR /app/frontend
RUN npm run build

# Build backend
WORKDIR /app
RUN npm run build

# Verify builds exist
RUN ls -la dist/
RUN ls -la frontend/dist/

# Expose port (PORT will be set at runtime by Koyeb)
EXPOSE 3000

# Start application using PORT environment variable
CMD ["sh", "-c", "node dist/server.js"]