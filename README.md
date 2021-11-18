Flashbake prototype
===================

Consists of:

* a typescript flashbake endpoint+relay with:
  * an injection endpoint for a tezos client to push an operation
  * logic to intercept mempool transmission between node and baker
* a nginx config acting as tezos rpc, and forwarding most queries to an actual tezos RPC, except the inject operation which goes to the flashbake endpoint+relay
* (later) a fork of tezos-k8s to host flashbake (not committed yet)

The json operation must be converted to binary in a format the baker likes. Once I get this working, I will publish complete instructions on how to replicate the prototype.
