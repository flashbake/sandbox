import express from 'express';

import { encodeOpHash } from "@taquito/utils";
var bodyParser = require('body-parser');

const app = express()
const port = 10732

app.use(bodyParser.text({type:"*/*"}));

app.post('/injection/operation', (req, res) => {
  console.log("transaction received:");
  console.log(JSON.parse(req.body));
  console.log("transaction hash:");
  const opHash = encodeOpHash(JSON.parse(req.body));
  console.log(opHash);
  res.json(opHash);
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
