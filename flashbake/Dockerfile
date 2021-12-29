FROM node:16

WORKDIR ./

COPY package*.json ./
COPY *.tgz ./
RUN npm install

COPY . .

CMD [ "node", "app.js" ]

