import express from 'express';
import { createProxyMiddleware, Filter, Options, RequestHandler } from 'http-proxy-middleware';
import { encodeOpHash } from "@taquito/utils";
import * as http from "http";

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

// mempool queries are handled directly
app.get('/chains/main/mempool/monitor_operations', (req, res) => {

  http.get('http://tezos-node-rpc:8732/chains/main/mempool/monitor_operations', (resp) => {

    res.setHeader('Content-Type', 'application/json');
    res.removeHeader("Connection");
    // A chunk of data has been received.
    resp.on('data', (chunk) => {
      console.log(chunk.toString());
      res.write(chunk);
    });
  
    // octez has ended the response (because a new head has been validated)
    resp.on('end', () => {
      res.end();
    });
  
  }).on("error", (err) => {
    console.log("Error: " + err.message);
  });
})

// every other query is directly proxied to the node
//const mempoolProxy = createProxyMiddleware({
//    target: 'http://tezos-node-rpc:8732',
//    changeOrigin: true });
//app.use('/**', mempoolProxy);

let server = app.listen(port, () => {
  console.log(`Flashbake relay and endpoint listening at http://localhost:${port}`)
})
server.setTimeout(500000);
