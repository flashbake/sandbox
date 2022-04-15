FROM node:17.4

WORKDIR /

COPY . /

COPY endpoints-monorepo/ /

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

