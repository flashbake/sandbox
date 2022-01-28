build:
	devspace build -t dev --skip-push

start:
	helm install -f tezos-k8s-flashbake-values.yaml flashbake tezos-k8s/charts/tezos --namespace flashbake --create-namespace

kill:
	kubectl delete ns flashbake

