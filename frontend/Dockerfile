# TarregaSheets Frontend Dockerfile
# React + TypeScript + Vite

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run development server
CMD ["npm", "run", "dev", "--", "--host"]
