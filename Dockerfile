# Match Playwright version
FROM mcr.microsoft.com/playwright:v1.56.1-jammy

WORKDIR /app
COPY . .

# Install server dependencies
WORKDIR /app/server
RUN npm ci

# Install framework dependencies
WORKDIR /app/framework
RUN npm ci

WORKDIR /app/server
EXPOSE 8080

CMD ["npm", "start"]