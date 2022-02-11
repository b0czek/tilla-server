FROM node:16-alpine

RUN mkdir /build
COPY package.json tsconfig.json src /build/
COPY src /build/src/
WORKDIR /build

RUN npm install \
    && npm run migrate \
    && npm run build \ 
    && mkdir /app \
    && cp -r dist package.json /app \
    && rm -rf /build

ENV NODE_ENV=production
WORKDIR /app
RUN npm install --production
EXPOSE 3001
CMD [ "npm", "run", "start" ]