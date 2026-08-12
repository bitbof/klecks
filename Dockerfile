FROM node

COPY . /var/www
WORKDIR /var/www

RUN npm install serve -g
RUN npm ci
RUN npm run icon:build
RUN npm run lang:build
RUN npm run build

ENTRYPOINT ["npx", "serve", "dist"]
EXPOSE 3000
