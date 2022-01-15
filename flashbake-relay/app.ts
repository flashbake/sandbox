import express from 'express';
import { InMemoryRegistryService, RegistryService } from "@flashbake/relay";
import { HttpRelay } from '@flashbake/relay';


function startRelay(port: number, rpcApiUrl: string, bakerAddress: string, bakerEndpointUrl: string): HttpRelay {
  const bakerRegistry = new InMemoryRegistryService();
  bakerRegistry.setEndpoint(bakerAddress, bakerEndpointUrl);

  const relayApp = express();
  const relayer = new HttpRelay(relayApp, bakerRegistry, rpcApiUrl);
  const server = relayApp.listen(port, () => {
    console.log(`Flashbake relay started on http://localhost:${port}`)
    console.log(`Relaying to ${bakerEndpointUrl} for address ${bakerAddress}`)
  })
  server.setTimeout(500000);

  return relayer;
}

function main() {
  const relayPort = 10732;
  const bakerPort = 11732;
  const rpcApiUrl = 'http://localhost:8732';
  const bakerAddress = 'tz1THLWsNuricp4y6fCCXJk5pYazGY1e7vGc';
  const bakerEndpointUrl = `http://localhost:${bakerPort}/flashbake/bundle`;

  startRelay(relayPort, rpcApiUrl, bakerAddress, bakerEndpointUrl);
}

main();