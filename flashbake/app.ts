import express from 'express';
import { Mempool, InMemoryMempool } from "@flashbake/relay";
import { HttpBakerEndpoint } from '@flashbake/baker-endpoint';


function startBakerEndpoint(relayListenerPort: number, bakerListenerPort: number, rpcApiUrl: string): HttpBakerEndpoint {
  const relayFacingApp = express();
  const bakerFacingApp = express();
  const mempool: Mempool = new InMemoryMempool();
  const baker = new HttpBakerEndpoint(relayFacingApp, bakerFacingApp, mempool, rpcApiUrl);

  relayFacingApp.listen(relayListenerPort, () => {
    console.log(`Baker Endpoint relay-facing listener started on http://localhost:${relayListenerPort}`);
  }).setTimeout(500000);
  bakerFacingApp.listen(bakerListenerPort, () => {
    console.log(`Baker Endpoint baker-facing listener started on http://localhost:${bakerListenerPort}`);
  }).setTimeout(500000);

  return baker;
}

function main() {
  const relayListenerPort = 11732;
  const bakerListenerPort = 12732;
  const bakerUrl = process.env["BAKER_URL"];
  const rpcApiUrl = `http://${bakerUrl}:8732`;

  startBakerEndpoint(relayListenerPort, bakerListenerPort, rpcApiUrl);
}

main();
