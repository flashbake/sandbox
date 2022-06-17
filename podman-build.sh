#!/bin/bash

eval $(minikube podman-env)
podman-remote build -t localhost/flashbake:dev -f flashbake/Dockerfile  flashbake/
podman-remote build -t localhost/flashbake-relay:dev -f flashbake-relay/Dockerfile  flashbake-relay/
