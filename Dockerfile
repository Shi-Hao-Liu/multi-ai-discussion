FROM node:18

WORKDIR /app

# Copy all files
COPY . .

# Install backend dependencies
RUN npm install

# Install frontend dependencies and build
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Go back to app root and build backend
WORKDIR /app
RUN npm run build

# Expose port (PORT will be set at runtime by Koyeb)
EXPOSE 3000

# Start application using PORT environment variable
# Use shell form (sh -c) to ensure environment variable expansion
CMD sh -c "node dist/server.js"