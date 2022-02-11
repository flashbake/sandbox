import express from 'express';
import { InMemoryRegistryService, RegistryService } from "@flashbake/relay";
import { HttpRelay } from '@flashbake/relay';
import { CachingBakingRightsService, BakingRightsService } from '@flashbake/relay';
import { GenericCycleMonitor, RpcBlockMonitor } from '@flashbake/relay';
import { RpcBakingRightsService } from '@flashbake/relay';
import * as http from "http";

async function getBlocksPerCycle(rpcApiUrl: string,
                                  retryTimeout = 1000,
                                  maxRetries = 100): Promise<number>
{
  return new Promise(async (resolve, reject) => {
    http.get(`${rpcApiUrl}/chains/main/blocks/head/context/constants`, (resp) => {
      const { statusCode } = resp;
      const contentType = resp.headers['content-type'] || '';

      var error;
      if (statusCode !== 200) {
        error = new Error(`Constants request failed with status code: ${statusCode}.`);
      } else if (!/^application\/json/.test(contentType)) {
        error = new Error(`Constants request produced unexpected response content-type ${contentType}.`);
      }
      if (error) {
        resp.resume();
        reject(error.message);
        return;
      }

      // A chunk of data has been received.
      var rawData = '';
      resp.on('data', (chunk) => { rawData += chunk; });
      resp.on('end', () => {
        try {
          resolve((JSON.parse(rawData) as {blocks_per_cycle: number}).blocks_per_cycle);
        } catch (e) {
          if (typeof e === "string") {
            reject(e);
          } else if (e instanceof Error) {
            reject(e.message);
          }
        }
      });
      }).on("error", (err) => {
        console.error("Constants request failed: " + err.message);
        if (maxRetries > 0) {
          setTimeout(() => {
            console.error(`Retrying constants request, retries left: ${--maxRetries}`);
            return getBlocksPerCycle(rpcApiUrl, retryTimeout, maxRetries);
          }, retryTimeout);
        } else {
          reject(`Error while getting constants:  + err.message`);
        }
      });
  })
}

function startRelay(port: number,
                    rpcApiUrl: string,
                    bakers: Map<string,string>,
                    blocksPerCycle: number): HttpRelay
{
  const bakerRegistry = new InMemoryRegistryService();
  
  bakers.forEach((bakerEndpointUrl, bakerAddress) => {
    bakerRegistry.setEndpoint(bakerAddress, bakerEndpointUrl);
    console.log(`Relaying to ${bakerEndpointUrl} for address ${bakerAddress}`)
  })

  const relayApp = express();
  const blockMonitor = new RpcBlockMonitor(rpcApiUrl);
  const bakingRightsService = new CachingBakingRightsService(new RpcBakingRightsService(rpcApiUrl), 
                                                              new GenericCycleMonitor(blockMonitor, blocksPerCycle));
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
  const blocksPerCycle = await getBlocksPerCycle(rpcApiUrl);

  console.debug(`Blocks per cycle: ${blocksPerCycle}`);

  startRelay(relayPort, rpcApiUrl, bakers, blocksPerCycle);
}

main();
