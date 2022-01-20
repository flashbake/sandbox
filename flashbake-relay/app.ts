import express from 'express';
import { InMemoryRegistryService, RegistryService } from "@flashbake/relay";
import { HttpRelay } from '@flashbake/relay';


function startRelay(port: number, rpcApiUrl: string, bakers: Map<string,string>): HttpRelay {
  const bakerRegistry = new InMemoryRegistryService();
  
  bakers.forEach((bakerEndpointUrl, bakerAddress) => {
    bakerRegistry.setEndpoint(bakerAddress, bakerEndpointUrl);
    console.log(`Relaying to ${bakerEndpointUrl} for address ${bakerAddress}`)
  })

  const relayApp = express();
  const relayer = new HttpRelay(relayApp, bakerRegistry, rpcApiUrl);
  const server = relayApp.listen(port, () => {
    console.log(`Flashbake relay started on http://localhost:${port}`)
  })
  server.setTimeout(500000);

  return relayer;
}

function main() {
  const relayPort = 10732;
  const bakerPort = 11732;
  const rpcApiUrl = 'http://localhost:8732';
  const bakers: Map<string,string> = new Map<string,string>([
    ['tz1THLWsNuricp4y6fCCXJk5pYazGY1e7vGc', `http://tezos-baking-node-0.tezos-baking-node:${bakerPort}/flashbake/bundle`],
    ['tz1RUyvixHtL1Pwwg41ZB9WKMWTQgC7gs3Z6', `http://tezos-baking-node-1.tezos-baking-node:${bakerPort}/flashbake/bundle`]
  ]);
  startRelay(relayPort, rpcApiUrl, bakers);
}

main();
