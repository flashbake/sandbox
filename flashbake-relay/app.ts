import express from 'express';
import {
  CachingBakingRightsService,
  GenericCycleMonitor,
  HttpRelay,
  InMemoryRegistryService,
  RpcBlockMonitor,
  TaquitoRpcService
} from "@flashbake/relay";

// Configurable parameters that are hardcoded for the prototype
// TODO(keefertaylor): Refactor these constants to make them configuratble.
const REGISTRY_CONTRACT_ADDRESS = "KT1QuofAgnsWffHzLA7D78rxytJruGHDe7XG"
const BLOCKS_PER_CYCLE = 8192

// Flashbake Protocol constants

// The annotation of the big map in the registry contract
const REGISTRY_BIG_MAP_ANNOTATION = "registry"

async function startRelay(port: number, rpcApiUrl: string, bakers: Map<string, string>): Promise<HttpRelay> {
  // Identify the big map to read data from.
  console.log(`Starting relay connected to node ${rpcApiUrl}`)
  const rpcService = new TaquitoRpcService(rpcApiUrl)

  // Read all rights for the cycle
  const blockMonitor = new RpcBlockMonitor(rpcApiUrl)
  const cycleMonitor = new GenericCycleMonitor(Promise.resolve(BLOCKS_PER_CYCLE), blockMonitor)
  const bakingRightsService = new CachingBakingRightsService(
    rpcApiUrl,
    cycleMonitor,
  )
  const bakersAssignedRights = await bakingRightsService.getBakingRights()
  console.log(`Identified ${bakersAssignedRights.length} bakers in the current cycle`)

  console.log("Syncing the baker's registry")
  const bakerRegistry = new InMemoryRegistryService();
  await bakerRegistry.initialize()

  bakers.forEach((bakerEndpointUrl, bakerAddress) => {
    bakerRegistry.setEndpoint(bakerAddress, bakerEndpointUrl);
    console.log(`Relaying to ${bakerEndpointUrl} for address ${bakerAddress}`)
  })

  // For each baker, query the flashbake contract
  for (let i = 0; i < bakersAssignedRights.length; i++) {
    const value = await rpcService.getBigMapValue(REGISTRY_CONTRACT_ADDRESS, REGISTRY_BIG_MAP_ANNOTATION, bakersAssignedRights[i])
    if (value !== undefined) {
      console.log(`Got value ${value}`)
    }
  }

  const relayApp = express();
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
  const bakers: Map<string, string> = new Map<string, string>([
    ['tz1THLWsNuricp4y6fCCXJk5pYazGY1e7vGc', `http://flashbake-baker-0.flashbake-baker:${bakerPort}/flashbake/bundle`],
    ['tz1RUyvixHtL1Pwwg41ZB9WKMWTQgC7gs3Z6', `http://flashbake-baker-1.flashbake-baker:${bakerPort}/flashbake/bundle`]
  ])

  startRelay(relayPort, rpcApiUrl, bakers);
}

main();
