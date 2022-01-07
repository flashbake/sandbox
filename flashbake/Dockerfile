FROM node:16

WORKDIR ./

COPY . .

# build dependencies
RUN cd ./endpoints-monorepo/core && \
  npm install && \
  npm run build && \
  cd ../relay/ && \
  npm install && \
  npm run build && \
  cd ../baker-endpoint/ && \
  npm install && \
  npm run build && \
  cd ../../

RUN npm install && \ 
  npm run build


CMD [ "node", "app.js" ]

