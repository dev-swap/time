# Use the official Node.js 20 image
FROM node:20

# Set the working directory
WORKDIR /usr/local/app

# Copy package.json and package-lock.json
COPY package.json .

# Install app dependencies
RUN npm install

# Copy the rest of the application code
COPY public .

# Expose the port your app runs on
EXPOSE 3000

# Define environment variables
ENV PORT=3000
ENV DATABASE_URL=postgres://postgres:your_password@db:5432/timedb
ENV JWT_SECRET=mySuperSecretKey123!

# Start the application
CMD ["node", "server.js"]
