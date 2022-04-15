#!/bin/bash

eval $(minikube podman-env)
podman-remote build -t localhost/tezos-k8s-flashbake:dev -f flashbake/Dockerfile  flashbake/
podman-remote build -t localhost/tezos-k8s-flashbake-relay:dev -f flashbake-relay/Dockerfile  flashbake-relay/
