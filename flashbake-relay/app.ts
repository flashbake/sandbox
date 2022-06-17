import express from 'express';
import {
  CachingBakingRightsService,
  RpcCycleMonitor,
  HttpRelay,
  OnChainRegistryService,
  RpcBlockMonitor,
  TaquitoRpcService,
} from "@flashbake/relay";

import yargs, { Argv } from "yargs";


// The annotation of the big map in the registry contract
const REGISTRY_BIG_MAP_ANNOTATION = "registry"

async function startRelay(port: number, rpcApiUrl: string, registryContract: string): Promise<HttpRelay> {
  // Identify the big map to read data from.
  console.log(`Starting relay connected to node ${rpcApiUrl}`)

  // Read all rights for the cycle
  const blockMonitor = new RpcBlockMonitor(rpcApiUrl)
  const bakingRightsService = new CachingBakingRightsService(
    rpcApiUrl,
    new RpcCycleMonitor(rpcApiUrl, blockMonitor),
  )

  const rpcService = new TaquitoRpcService(rpcApiUrl);
  const bakerRegistry = new OnChainRegistryService(rpcService, registryContract, REGISTRY_BIG_MAP_ANNOTATION);
  bakerRegistry.initialize()

  const relayApp = express();
  const relayer = new HttpRelay(relayApp, bakerRegistry, rpcApiUrl, bakingRightsService, blockMonitor);
  const server = relayApp.listen(port, () => {
    blockMonitor.start();
    console.log(`Flashbake relay started on http://localhost:${port}`);
  });
  server.setTimeout(500000);

  return relayer;
}

async function main() {
  let argv = await yargs
    .command('start', "Start flashbake-relay.", (yargs: Argv) => {
      return yargs.option('registry_contract', {
        describe: "Registry contract address",
        type: "string",
        demandOption: true,
      }).option('tezos_rpc_url', {
        describe: "Tezos node RPC API URL",
        type: "string",
        demandOption: true,
      }).option('relay_port', {
        describe: "The port the relay is listening to",
        type: "number",
        demandOption: true,
      })
    }).argv;

  startRelay(argv.relay_port, argv.tezos_rpc_url, argv.registry_contract);
}

main();
