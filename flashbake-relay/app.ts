import express from 'express';
import {
  CachingBakingRightsService,
  RpcCycleMonitor,
  HttpRelay,
  OnChainRegistryService,
  RpcBlockMonitor,
  TaquitoRpcService,
} from "@flashbake/relay";

// Configurable parameters that are hardcoded for the prototype
// TODO(keefertaylor): Refactor these constants to make them configuratble.
const REGISTRY_CONTRACT_ADDRESS = "KT1QuofAgnsWffHzLA7D78rxytJruGHDe7XG"
// The annotation of the big map in the registry contract
const REGISTRY_BIG_MAP_ANNOTATION = "registry"

async function startRelay(port: number, rpcApiUrl: string): Promise<HttpRelay> {
  // Identify the big map to read data from.
  console.log(`Starting relay connected to node ${rpcApiUrl}`)

  // Read all rights for the cycle
  const blockMonitor = new RpcBlockMonitor(rpcApiUrl)
  const bakingRightsService = new CachingBakingRightsService(
    rpcApiUrl,
    new RpcCycleMonitor(rpcApiUrl, blockMonitor),
  )

  const rpcService = new TaquitoRpcService(rpcApiUrl);
  const bakerRegistry = new OnChainRegistryService(rpcService, REGISTRY_CONTRACT_ADDRESS, REGISTRY_BIG_MAP_ANNOTATION);
  bakerRegistry.initialize()

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

  startRelay(relayPort, rpcApiUrl);
}

main();
