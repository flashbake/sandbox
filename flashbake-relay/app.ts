import express from 'express';

const app = express();
const port = 11732;
const server = app.listen(port, () => {
  console.log(`Hello world, Flashbake relay placeholder is running`);
})
server.setTimeout(500000);
