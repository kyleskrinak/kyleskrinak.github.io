FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy project files
COPY . .

# Build the project
RUN npm run build:ci

# Optional: Serve the built site (for testing)
# CMD ["npm", "run", "preview"]
