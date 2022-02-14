import express from 'express';
import { InMemoryRegistryService, RegistryService } from "@flashbake/relay";
import { HttpRelay } from '@flashbake/relay';
import { CachingBakingRightsService, BakingRightsService } from '@flashbake/relay';
import { GenericCycleMonitor, RpcBlockMonitor } from '@flashbake/relay';
import { RpcBakingRightsService } from '@flashbake/relay';
import { RpcCycleMonitor } from '@flashbake/relay';


function startRelay(port: number,
                    rpcApiUrl: string,
                    bakers: Map<string,string>): HttpRelay
{
  const bakerRegistry = new InMemoryRegistryService();
  
  bakers.forEach((bakerEndpointUrl, bakerAddress) => {
    bakerRegistry.setEndpoint(bakerAddress, bakerEndpointUrl);
    console.log(`Relaying to ${bakerEndpointUrl} for address ${bakerAddress}`)
  })

  const relayApp = express();
  const blockMonitor = new RpcBlockMonitor(rpcApiUrl);
  const bakingRightsService = new CachingBakingRightsService(rpcApiUrl,
    new RpcCycleMonitor(rpcApiUrl, blockMonitor));
  const relayer = new HttpRelay(relayApp, bakerRegistry, rpcApiUrl, bakingRightsService);
  const server = relayApp.listen(port, () => {
    blockMonitor.start();
    console.log(`Flashbake relay started on http://localhost:${port}`);
  });
  server.setTimeout(500000);

  return relayer;
}

async function main() {
  const relayPort = 10732;
  const bakerPort = 11732;
  const rpcApiUrl = 'http://localhost:8732';
  const bakers: Map<string,string> = new Map<string,string>([
    ['tz1THLWsNuricp4y6fCCXJk5pYazGY1e7vGc', `http://flashbake-baker-0.flashbake-baker:${bakerPort}/flashbake/bundle`],
    ['tz1RUyvixHtL1Pwwg41ZB9WKMWTQgC7gs3Z6', `http://flashbake-baker-1.flashbake-baker:${bakerPort}/flashbake/bundle`]
  ]);

  startRelay(relayPort, rpcApiUrl, bakers);
}

main();
