# # Match Playwright version
# FROM mcr.microsoft.com/playwright:v1.56.1-jammy

# WORKDIR /app
# COPY . .

# # Install server dependencies
# WORKDIR /app/server
# RUN npm ci

# # Install framework dependencies
# WORKDIR /app/framework
# RUN npm ci

# WORKDIR /app/server
# EXPOSE 8080

# CMD ["npm", "start"]



# Match Playwright version with your framework (@playwright/test)
FROM mcr.microsoft.com/playwright:v1.56.1-jammy

# App root inside container
WORKDIR /app

# Copy entire repo
COPY . .

# Install Java (required for Allure report generation)
RUN apt-get update \
  && apt-get install -y openjdk-17-jre-headless \
  && rm -rf /var/lib/apt/lists/*

# Install server dependencies
WORKDIR /app/server
RUN npm ci

# Install framework dependencies
WORKDIR /app/framework
RUN npm ci

# Back to server
WORKDIR /app/server

EXPOSE 8080

# Start Express server
CMD ["npm", "start"]
