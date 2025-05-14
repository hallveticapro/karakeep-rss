# Use official Node LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy application files
COPY . .

# Build Next.js app in standalone mode
RUN npm run build

# Expose the port
EXPOSE 3000

# Start production server
CMD ["npm", "start"]