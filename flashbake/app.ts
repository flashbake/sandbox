import express from 'express';
import { Mempool, InMemoryMempool } from "@flashbake/relay";
import { HttpBakerEndpoint } from '@flashbake/baker-endpoint';
import yargs, { Argv } from "yargs";

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

async function main() {
  let argv = await yargs
    .command('start', "Start flashbake-endpoint.", (yargs: Argv) => {
      return yargs.option('relay_listener_port', {
        describe: "Relay listener port",
        type: "number",
        demandOption: true,
      }).option('tezos_rpc_url', {
        describe: "Tezos node RPC API URL",
        type: "string",
        demandOption: true,
      }).option('baker_listener_port', {
        describe: "Baker listener port",
        type: "number",
        demandOption: true,
      })
    }).argv;

  startBakerEndpoint(argv.relay_listener_port, argv.baker_listener_port, argv.tezos_rpc_url);
}

main();
