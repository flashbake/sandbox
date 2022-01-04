import express from 'express';
import { InMemoryMempool, InMemoryRegistryService, Mempool, RegistryService } from "@flashbake/relay";
import { HttpRelay } from '@flashbake/baker-endpoint';


const app = express();
const port = 10732;

const rpcApiUrl = 'http://localhost:8732';
const selfAddress = 'tz1THLWsNuricp4y6fCCXJk5pYazGY1e7vGc';
const selfEndpointUrl = `http://localhost:${port}/flashbake_injection/operation`;
const mempool: Mempool = new InMemoryMempool();
const bakerRegistry = new InMemoryRegistryService();

bakerRegistry.setEndpoint(selfAddress, selfEndpointUrl);
export const relayer = new HttpRelay(app, bakerRegistry, mempool, rpcApiUrl, selfEndpointUrl);

const server = app.listen(port, () => {
  console.log(`Flashbake relay and endpoint listening at http://localhost:${port}`)
  console.log(`Advertizing endpoint ${selfEndpointUrl} for address ${selfAddress}`)
})
server.setTimeout(500000);
