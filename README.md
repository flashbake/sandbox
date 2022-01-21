Flashbake prototype
===================

Consists of:

* a typescript **flashbake endpoint** with:
  * an injection endpoint for a tezos client to push an operation to an internal flashbake mempool
  * logic to intercept mempool transmission between node and baker, injecting an operation from the flashbake mempool if any are present,
  * proxies any other request from baker to node
* **flashbake relay**, a nginx config acting as tezos rpc, and forwarding most queries to an actual tezos RPC, except the inject operation which goes to the flashbake endpoint
* a fork of tezos-k8s that hosts the flashbake endpoint as a proxy between node and baker, listening on port 10732 as injection endpoint

This prototype does not have:

* support for different bakers. In this setup, the one baker has every baking right at every block,
* client/server bundle protocol between the endpoint and the relay. The relay is a dumb nginx rule that redirects all injections to the one and only flashbake endpoint,
* an auction mechanism that compares fees and only injects the highest fee.

## How to deploy the prototype locally

You need minikube and devspace.

Clone this repo's submodules.

Build the flashbake container into your minikube instance:

```
devspace build -t dev --skip-push
```

Deploy tezos-k8s, flashbake edition:

```
helm install -f tezos-k8s-flashbake-values.yaml flashbake tezos-k8s/charts/tezos --namespace flashbake --create-namespace
```

## Run a flashbake transaction

Open a shell in tezos-node-0 pod, octez-node container.

Create a new test account and send tez to it the normal way (via the node mempool):

```
tezos-client -d /var/tezos/client gen keys test
tezos-client -d /var/tezos/client  transfer 444 from tezos-baking-node-0 to test --burn-cap 0.257
```

To send a transaction with flashbake, bypassing the mempool, change the endpoint to the flashbake relay:

```
tezos-client -d /var/tezos/client --endpoint http://flashbake-relay-0.flashbake-relay:10732 transfer 555 from tezos-baking-node-0 to test
```
