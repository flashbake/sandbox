"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var http_proxy_middleware_1 = require("http-proxy-middleware");
var utils_1 = require("@taquito/utils");
var bodyParser = require('body-parser');
var app = (0, express_1.default)();
var port = 10732;
app.use(bodyParser.text({ type: "*/*" }));
app.post('/injection/operation', function (req, res) {
    console.log("flashbake transaction received from client:");
    console.log(JSON.parse(req.body));
    console.log("transaction hash:");
    var opHash = (0, utils_1.encodeOpHash)(JSON.parse(req.body));
    console.log(opHash);
    res.json(opHash);
});
var mempoolProxy = (0, http_proxy_middleware_1.createProxyMiddleware)({
    target: 'http://tezos-node-rpc:8732',
    changeOrigin: true
});
app.use('/chains/main/mempool/monitor_operations', mempoolProxy);
app.use('/chains/main/chain_id', mempoolProxy);
app.listen(port, function () {
    console.log("Flashbake relay and endpoint listening at http://localhost:" + port);
});
