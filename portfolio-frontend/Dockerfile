# Development Dockerfile for Portfolio Frontend
# This runs the dev server for hot reload during development
# For production, use npm run build and serve the dist/ folder

FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Expose port
EXPOSE 5173

# Run dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
