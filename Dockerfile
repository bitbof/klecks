FROM node

COPY . /var/www
WORKDIR /var/www

RUN npm install serve -g
RUN npm install
RUN npm run lang:build
RUN npm run build
RUN npm run build:help

ENTRYPOINT ["npx", "serve", "dist"]
EXPOSE 3000
