Flashbake prototype
===================

Consists of:

* a typescript flashbake endpoint+relay with:
  * an injection endpoint for a tezos client to push an operation
  * logic to intercept mempool transmission between node and baker
* a nginx config acting as tezos rpc, and forwarding most queries to an actual tezos RPC, except the inject operation which goes to the flashbake endpoint+relay
* a fork of tezos-k8s to host flashbake

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

Deploy the flashbake relay (which is just a nginx container with some custom config):

```
kubectl apply -f flashbake-relay-k8s/flashbake-relay.yaml
```

## Run a flashbake transaction

Open a shell in octez-node container.

Create a new test account and send tez to it the normal way (via the node mempool):

```
tezos-client -d /var/tezos/client gen keys test
tezos-client -d /var/tezos/client  transfer 444 from tezos-baking-node-0 to test --burn-cap 0.257
```

To send a transaction with flashbake, bypassing the mempool, change the endpoint to the flashbake relay:

```
tezos-client -d /var/tezos/client --endpoint http://flashbake-relay:8732 transfer 555 from tezos-baking-node-0 to test --burn-cap 0.257
```
