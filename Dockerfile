# Playwright image already has browsers + required Linux deps
FROM mcr.microsoft.com/playwright:v1.54.0-jammy

# App root inside container
WORKDIR /app

# Copy your whole repo into container
COPY . .

# Install server dependencies
WORKDIR /app/server
RUN npm ci

# Install framework dependencies
WORKDIR /app/framework
RUN npm ci

# Go back to server
WORKDIR /app/server

# Railway sets PORT automatically; we'll expose a common port
EXPOSE 8080

# Start your Express server
CMD ["npm", "start"]
