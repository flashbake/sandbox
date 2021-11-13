import express from 'express';
import { createProxyMiddleware, Filter, Options, RequestHandler } from 'http-proxy-middleware';
import { encodeOpHash } from "@taquito/utils";
var bodyParser = require('body-parser');

const app = express()
const port = 10732

app.use(bodyParser.text({type:"*/*"}));

app.post('/injection/operation', (req, res) => {
  console.log("flashbake transaction received from client:");
  console.log(JSON.parse(req.body));
  console.log("transaction hash:");
  const opHash = encodeOpHash(JSON.parse(req.body));
  console.log(opHash);
  res.json(opHash);
})


const mempoolProxy = createProxyMiddleware({
    target: 'http://tezos-node-rpc:8732',
    changeOrigin: true });

app.use('/chains/main/mempool/monitor_operations', mempoolProxy);
app.use('/chains/main/chain_id', mempoolProxy);
app.listen(port, () => {
  console.log(`Flashbake relay and endpoint listening at http://localhost:${port}`)
})
