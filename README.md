Flashbake prototype
===================

[Flashbake](https://forum.tezosagora.org/t/announcing-flashbake-an-initiative-to-tackle-bpev-on-tezos/4006) aims at exploring the problems of Block Producer Extractable Value on Tezos.

This repo contains a prototype consisting of a self-contained Tezos private chain running Flashbake. It can be deployed locally on a laptop with minikube and helm.

Upon deployment, you will have:

* two Flashbake-capable bakers (or *Flashbakers*)  with a **flashbake endpoint** exposing:
  * an injection endpoint for the flashbake relay to inject operations directly into the node, bypassing mempool
  * an endpoint for the baker to query an external mempool
* two regular (non-flashbake) bakers. The stake distribution is equal between flashbakers and regular bakers
* a **flashbake relay**, forwarding most queries to an actual tezos RPC, except the inject operation which goes to the flashbake endpoint of the next flashbaker. The relay is backed by a dedicated tezos node.
* an **on-chain registry contract** where flashbakers can register their endpoints

## How to deploy the prototype locally

You need minikube and helm.

Install Oxhead Alpha and Flashbake helm repositories:

```
helm repo add oxheadalpha https://oxheadalpha.github.io/tezos-helm-charts/
helm repo add flashbake https://flashbake.github.io/endpoints-monorepo/
```

Or update it if necessary:

```
helm repo update oxheadalpha
helm repo update flashbake
```

Next, we deploy 4 charts: one is running a private Tezos chain with `tezos-k8s`, the others are running two flashbake endpoints and one flashbake relay:

```
helm install -f tezos-k8s-flashbake-values.yaml flashbake oxheadalpha/tezos-chain --version 6.7.0 --namespace flashbake --create-namespace && \
helm install flashbake-endpoint-0 flashbake/baker-endpoint --namespace flashbake --set tezos_rpc_url=http://flashbake-baker-0:8732 --set relay_listener_port=11732 --set baker_listener_port=12732 && \
helm install flashbake-endpoint-1 flashbake/baker-endpoint --namespace flashbake --set tezos_rpc_url=http://flashbake-baker-1:8732 --set relay_listener_port=11732 --set baker_listener_port=12732 && \
helm install flashbake-relay flashbake/relay --namespace flashbake --set tezos_rpc_url=http://flashbake-relay-node:8732 --set registry_contract=KT1QuofAgnsWffHzLA7D78rxytJruGHDe7XG --set relay_port=8732
```


We recommend a tool like k9s to visualize the contents of your cluster.

You can see 7 pods in the newly created flashbake namespace:
* flashbake-baker-0-0 and -1: flashbake-capable nodes and bakers
* flashbake-endpoint-0 and -1: endpoints for the flashbake-capable bakers above
* regular-baker-0: regular (non flashbake-capable) node and bakers for illustrative purposes
* flashbake-relay-node: pod containing a tezos-node (non-baking) used by the flashake relay
* flashbake-relay: the flashbake relay using the node above as backend

The "activation" job  injects a genesis block and your chain starts producing blocks.

## Run a flashbake transaction

Open a shell in regular-baker-0 pod, octez-node container.

From within the container, you have access to the baker's funds. The account alias is `regular-baker-0`.

Create a new test account and send tez to it the normal way (via the node mempool):

```
tezos-client gen keys test
tezos-client transfer 444 from regular-baker-0 to test --burn-cap 0.257
```

Observe the transaction going through instantly (block times are 5 seconds).

To send a transaction with flashbake, bypassing the mempool, change the endpoint to the flashbake relay:

```
tezos-client --endpoint http://flashbake-relay:8732 transfer 555 from regular-baker-0 to test
```

Observe the transaction going through, but slower than previously: only half of the bakers are flashbakers, you must wait until it is a flashbaker's time to bake.

## Verify mempool bypass

Forward any node's RPC port (8732) locally. With k9s, select an `octez-node` then press Shift-F and enter 3 times.

The endpoint `/chains/main/mempool/monitor_operations` streams the mempool operations as they come, but it closes the connection at every block. To store all mempool operations in a file, run in a new terminal on your machine:

```
while true; do curl -s http://localhost:8732/chains/main/mempool/monitor_operations; done > mempool &
```

Then, back in k9s, open a shell again to `regular-baker-0` and run the same operations again:

```
tezos-client transfer 444 from regular-baker-0 to test
```

The output of the transaction should show the operation hash:

```
Node is bootstrapped.
Estimated gas: 1420.040 units (will add 100 for safety)
Estimated storage: no bytes added
Operation successfully injected in the node.
Operation hash is 'onhHbaKDnzVKyMMF1gUgxgE63BnPuHtJnxbQikyaxsLFyB7hGb5'
Waiting for the operation to be included...
```

Back in your terminal window that is monitoring the mempool, grep the operation hash against the mempool file. You should get a match:

```
nochem@fedora /tmp $ grep onhHbaKDnzVKyMMF1gUgxgE63BnPuHtJnxbQikyaxsLFyB7hGb5 mempool
[{"hash":"onhHbaKDnzVKyMMF1gUgxgE63BnPuHtJnxbQikyaxsLFyB7hGb5","protocol":"Psithaca2MLRFYargivpo7YvUr7wUDqyxrdhC5CQq78mRvimz6A","branch":"BL5z4pBBzfgJzcPWLpPbTGKTRsCgXW9dPEx7sRrNHVp76kA5EVN","contents":[{"kind":"transaction","source":"tz1RboUV4wePuCRgd9gWHozaGnpsGo7sKouw","fee":"405","counter":"8","gas_limit":"1521","storage_limit":"0","amount":"44
4000000","destination":"tz1RSXyZktt71oeP624wXsyvSYrGWpTfcb53"}],"signature":"sigcHJYyQvADa1LGEeNbFtZ8yj2X1
```

Then back into k9s, run the flashbake operation again:

```
tezos-client --endpoint http://flashbake-relay:10732 transfer 555 from regular-baker-0 to test
```

Grab the operation hash from the output:
```
Node is bootstrapped.
Estimated gas: 1420.040 units (will add 100 for safety)
Estimated storage: no bytes added
Operation successfully injected in the node.
Operation hash is 'ooSivkZagBEa8EP2WvgrRBq8rUzHueGdTCsFgGyS7NMFtLeZ6wE'
```

Grep the operation hash against the mempool file. There is no match. The operation bypassed the mempool.

```
nochem@fedora /tmp $ grep ooSivkZagBEa8EP2WvgrRBq8rUzHueGdTCsFgGyS7NMFtLeZ6wE mempool
nochem@fedora /tmp $
```

## Flashbake Contracts

A `registry` and `administrator` contract are deployed at Genesis. The `registry` contract contains a mapping of Baker Addresses to Endpoints and collects deposits. The `administrator` contract can administer fees.

The contracts are deployed at:
```
Multisig: KT1CSKPf2jeLpMmrgKquN2bCjBTkAcAdRVDy
Registry: KT1QuofAgnsWffHzLA7D78rxytJruGHDe7XG
```

The contract code is located in this repository: [registry-contract](https://github.com/flashbake/registry-contract).

## Flashbake relay

The source code for the relay and endpoint is in the [endpoints-monorepo](https://github.com/flashbake/endpoints-monorepo).

Let's observe the logs of the flashbake relay:

```
│ New cycle 0 started.                                                                                                                                                              │
│ New cycle started, refreshing baking rights assignments.                                                                                                                          │
│ Baker of block level 2 at 2022-04-15T00:56:35Z was tz1fb1RzVWyrkPb6BBWR7D1hf3GyWzGifraf                                                                                           │
│ Baker of block level 3 at 2022-04-15T00:56:40Z was tz1RboUV4wePuCRgd9gWHozaGnpsGo7sKouw                                                                                           │
│ Baker of block level 4 at 2022-04-15T00:56:45Z was tz1fb1RzVWyrkPb6BBWR7D1hf3GyWzGifraf                                                                                           │
│ Baker of block level 5 at 2022-04-15T00:56:50Z was tz1Rb1cTbq4KXzjkVU8zMFNhMosqFgxi6D2h                                                                                           │
│ Baker of block level 6 at 2022-04-15T00:56:55Z was tz1fb1RzVWyrkPb6BBWR7D1hf3GyWzGifraf                                                                                           │
│ Baker of block level 7 at 2022-04-15T00:57:00Z was tz1fboti4soXCzGKXK5WfEEpHxPi59WoRoQY                                                                                           │
│ Baker of block level 8 at 2022-04-15T00:57:05Z was tz1Rb1cTbq4KXzjkVU8zMFNhMosqFgxi6D2h                                                                                           │
│ Baker of block level 9 at 2022-04-15T00:57:10Z was tz1RboUV4wePuCRgd9gWHozaGnpsGo7sKouw                                                                                           │
│ Baker of block level 10 at 2022-04-15T00:57:15Z was tz1Rb1cTbq4KXzjkVU8zMFNhMosqFgxi6D2h        
```

The relay is attached to a non-baking node and monitors all the blocks.

For convenience during the demo, we are using vanity accounts to designate bakers:

| | |
|-|-|
|Flashbaker 0 | `tz1fbo...`|
|Flashbaker 1 | `tz1fb1...`|
|Regular baker 0| `tz1Rbo...`|
|Regular baker 1| `tz1Rb1...`|

The first thing the relay does is query the registry contract for the current list of flashbakers and their endpoints. The registry contract address is set in the relay's configuration.

Then it queries the block assignments for the current cycle.

The client targets the flashbake relay as its endpoint. The relay forwards all RPC requests to its backing node except the injection operation.

When it receives an injection operation, here is what happens:

```
│ Baker of block level 11 at 2022-04-15T00:57:20Z was tz1RboUV4wePuCRgd9gWHozaGnpsGo7sKouw                                                                                          │
│ Flashbake transaction received from client                                                                                                                                        │
│ Found endpoint http://flashbake-baker-0.flashbake-baker:11732/flashbake/bundle for baker tz1fboti4soXCzGKXK5WfEEpHxPi59WoRoQY in flashbake registry.                              │
│ Next flashbaker tz1fboti4soXCzGKXK5WfEEpHxPi59WoRoQY will bake at level 13, sending bundle.                                                                                       │
│ Baker of block level 12 at 2022-04-15T00:57:25Z was tz1Rb1cTbq4KXzjkVU8zMFNhMosqFgxi6D2h                                                                                          │
│ Transaction hash ooFhAeMhy3YHKH9wUXupTu2tEGdmV8iShhFiznMC7Wy9EfgyBMG not detected, resending the bundle.                                                                          │
│ Found endpoint http://flashbake-baker-0.flashbake-baker:11732/flashbake/bundle for baker tz1fboti4soXCzGKXK5WfEEpHxPi59WoRoQY in flashbake registry.                              │
│ Next flashbaker tz1fboti4soXCzGKXK5WfEEpHxPi59WoRoQY will bake at level 13, sending bundle.                                                                                       │
│ Baker of block level 13 at 2022-04-15T00:57:30Z was tz1fboti4soXCzGKXK5WfEEpHxPi59WoRoQY                                                                                          │
│ Relayed bundle identified by operation hash ooFhAeMhy3YHKH9wUXupTu2tEGdmV8iShhFiznMC7Wy9EfgyBMG found on-chain.                                                                   │
│ 0 bundles remain pending.                                                               
```

The node figures which is the next flashbaker, assembles the transaction into a "Bundle", then sends it. For now, a bundle contains just one transaction. In a future iteration of flashbake, bundles will contain several of them.

At every block, regardless of baker, it monitors the operations to figure if the block has been included. If not, it keeps sending it to the next flashbaker until it is.

Anyone can run a relay.

## Flashbake endpoints

The flashbake endpoint is set up by the baker as an auxiliary service. It listens to 2 ports: baker port and relay port.

It puts incoming bundles to the flashbake mempool. When receiving a request from the baker, it returns the bundle containing the transaction with the highest fee.

```
│ Adding incoming bundle to Flashbake mempool. Number of bundles in pool: 1                                                                                                         │
│ Adding incoming bundle to Flashbake mempool. Number of bundles in pool: 1                                                                                                         │
│ Incoming operations-pool request from baker.                                                                                                                                      │
│ Out of 1 bundles, #0 is winning the auction with a fee of 500000 mutez.                                                                                                           │
│ Exposing the following data to the external operations pool:                                                                                                                      │
│ [                                                                                                                                                                                 │
│   {                                                                                                                                                                               │
│     "branch": "BME2hzXKLF1A1bRxKGH5u92KXG344bkui7orAwcTBDCf7pYe4p2",                                                                                                              │
│     "contents": [                                                                                                                                                                 │
│       {                                                                                                                                                                           │
│         "kind": "transaction",                                                                                                                                                    │
│         "source": "tz1RboUV4wePuCRgd9gWHozaGnpsGo7sKouw",                                                                                                                         │
│         "fee": "500000",                                                                                                                                                          │
│         "counter": "7",                                                                                                                                                           │
│         "gas_limit": "1521",                                                                                                                                                      │
│         "storage_limit": "0",                                                                                                                                                     │
│         "amount": "555000000",                                                                                                                                                    │
│         "destination": "tz1RSXyZktt71oeP624wXsyvSYrGWpTfcb53"                                                                                                                     │
│       }                                                                                                                                                                           │
│     ],                                                                                                                                                                            │
│     "signature": "edsigthC1nxCvcvzPs7qNjGNcsyPwGw179izUbYGXwg75xujKpBUmxRswNQJRP5xjxY3D4RJbDcKz52RPRpzfHpt2ZZuv31BWPD"                                                            │
│   }                                                                                                                                                                               │
│ ]                                                                                                     
```

## Auction demo

From regular-baker-0, send 2 Flashbake transactions in quick succession, with increasing fees:

```
~ $ tezos-client --endpoint http://flashbake-relay:10732 transfer 2 from regular-baker-0 to test --fee 0.5 &
~ $ tezos-client --endpoint http://flashbake-relay:10732 transfer 2 from regular-baker-1 to test --fee 0.8 &
```

Observe that the second transaction with the higher fee completes faster:

```
[2]+  Done                       tezos-client --endpoint http://flashbake-relay:10732 transfer 2 from regular-baker-1 to test --fee 0.8
[1]+  Done                       tezos-client --endpoint http://flashbake-relay:10732 transfer 2 from regular-baker-0 to test --fee 0.5
```

The relay just forwards all of the transactions sent its way to the next flashbaker endpoint.

The endpoint indeed receives 2 bundles, and picks the one with a fee of 0.8:

```
│ Adding incoming bundle to Flashbake mempool. Number of bundles in pool: 1                                                                         │
│ Adding incoming bundle to Flashbake mempool. Number of bundles in pool: 1                                                                         │
│ Adding incoming bundle to Flashbake mempool. Number of bundles in pool: 2                                                                         │
│ Incoming operations-pool request from baker.                                                                                                      │
│ Out of 2 bundles, #1 is winning the auction with a fee of 800000 mutez.                                                                           │
│ Exposing the following data to the external operations pool:                                                                                      │
│ [                                                                                                                                                 │
│   {                                                                                                                                               │
│     "branch": "BLG9Rj7r6dJfYKiWsPV3BMWAz2FzMDZcEwicni5Dek3Bn1LkexR",                                                                              │
│     "contents": [                                                                                                                                 │
│       {                                                                                                                                           │
│         "kind": "transaction",                                                                                                                    │
│         "source": "tz1Rb1cTbq4KXzjkVU8zMFNhMosqFgxi6D2h",                                                                                         │
│         "fee": "800000",                                                                                                                          │
│         "counter": "1",                                                                                                                           │
│         "gas_limit": "1521",                                                                                                                      │
│         "storage_limit": "0",                                                                                                                     │
│         "amount": "2000000",                                                                                                                      │
│         "destination": "tz1asRQmb4NYBo4diURCLddrVxnPEQ6iHFGn"                                                                                     │
│       }                                                                                                                                           │
│     ],                                                                                                                                            │
│     "signature": "edsigu5oznSdkYDaQLnzMPKWqLwNU1PeQUzCfER7xMKAY8dLrqSBFwM6qRdbRZ5EfQy3XokHb6UJ2rmWKbsSFct7EB16jZtPGnB"                            │
│   }                                                                                                                                               │
│ ]                                                                                                                  
```
