# Dockerfile for Null Downloader (Debian-based for high stability)
FROM node:18

# Install runtime dependencies (yt-dlp and ffmpeg)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    && pip3 install --no-cache-dir yt-dlp \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install --only=production

# Copy application files
COPY . .

# Create tmp directory with proper permissions
RUN mkdir -p tmp && chmod 777 tmp

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "server.js"]
