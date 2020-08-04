FROM node:12-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Copy build config then sources
COPY .eslintrc.yaml .prettierrc babel.config.json gulpfile.js tsconfig.json ./
COPY src src

# Build app
RUN npm run build

FROM node:12-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY --from=build /app/lib lib

ENTRYPOINT [ "npm", "start" ]
