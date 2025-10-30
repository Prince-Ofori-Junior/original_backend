# -------------------------------
# Stage 1: Build / install dependencies
# -------------------------------
FROM node:20-alpine AS build

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install --production

# Copy all source files
COPY ./src ./src

# Copy .env file
COPY .env ./

# -------------------------------
# Stage 2: Production image
# -------------------------------
FROM node:20-alpine AS prod

# Set working directory
WORKDIR /usr/src/app

# Copy only production dependencies
COPY --from=build /usr/src/app/node_modules ./node_modules

# Copy app source code
COPY --from=build /usr/src/app/src ./src

# Copy .env
COPY --from=build /usr/src/app/.env ./

# Expose port
EXPOSE 5000

# Use a non-root user for better security
USER node

# Start the application
CMD ["node", "src/server.js"]
