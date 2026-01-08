# Match Playwright version with framework package.json
FROM mcr.microsoft.com/playwright:v1.56.1-jammy

# App root inside container
WORKDIR /app

# Copy entire repo
COPY . .

# Install server dependencies
WORKDIR /app/server
RUN npm ci

# Install framework dependencies
WORKDIR /app/framework
RUN npm ci

# Back to server
WORKDIR /app/server

# Railway exposes PORT automatically
EXPOSE 8080

# Start Express server
CMD ["npm", "start"]
