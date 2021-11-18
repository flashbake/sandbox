import express from 'express';
import { createProxyMiddleware, Filter, Options, RequestHandler } from 'http-proxy-middleware';
import { encodeOpHash } from "@taquito/utils";
import * as http from "http";

var bodyParser = require('body-parser');

const app = express()
const port = 10732

const mempoolProxy = createProxyMiddleware({
    target: 'http://localhost:8732',
    changeOrigin: false });

// The flashbake mempool. We push/pop operations from it.
let flashbakePool: string[] = [];

// URL where this daemon receives operations to be directly injected, bypassing mempool
app.post('/flashbake_injection/operation', bodyParser.text({type:"*/*"}), (req, res) => {
  let transaction = JSON.parse(req.body);
  console.log("flashbake transaction received from client:");
  console.log(transaction);
  flashbakePool.push(transaction);

  // the client expects the transaction hash to be immediately returned
  console.log("transaction hash:");
  const opHash = encodeOpHash(JSON.parse(req.body));
  console.log(opHash);
  res.json(opHash);
})

// the baker queries the node's mempool in binary format (important)
const octezMempoolRequestOpts = {
    hostname: '127.0.0.1',
    port: 8732,
    path: '/chains/main/mempool/monitor_operations',
    headers: {'accept': 'application/octet-stream' }
}
// mempool queries are handled directly
app.get('/chains/main/mempool/monitor_operations', (req, res) => {

  http.get(octezMempoolRequestOpts,
  (resp) => {
    res.removeHeader("Connection");
    // A chunk of data has been received.
    resp.on('data', (chunk) => {
      console.log("Received the following from node's mempool:");
      console.log(JSON.stringify(chunk));
      if (flashbakePool.length > 0) {
          // FIXME: must convert json to binary
          res.write(flashbakePool.splice(0));
      }
      console.log("Injecting");
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
//every query except mempool is directly proxied to the node
app.use('/*', mempoolProxy);

//
let server = app.listen(port, () => {
  console.log(`Flashbake relay and endpoint listening at http://localhost:${port}`)
})
server.setTimeout(500000);
