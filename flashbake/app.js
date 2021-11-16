"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var http_proxy_middleware_1 = require("http-proxy-middleware");
var utils_1 = require("@taquito/utils");
var http = __importStar(require("http"));
var bodyParser = require('body-parser');
var app = (0, express_1.default)();
var port = 10732;
var mempoolProxy = (0, http_proxy_middleware_1.createProxyMiddleware)({
    target: 'http://localhost:8732',
    changeOrigin: false
});
app.post('/flashbake_injection/operation', bodyParser.text({ type: "*/*" }), function (req, res) {
    console.log("flashbake transaction received from client:");
    console.log(JSON.parse(req.body));
    console.log("transaction hash:");
    var opHash = (0, utils_1.encodeOpHash)(JSON.parse(req.body));
    console.log(opHash);
    res.json(opHash);
});
// mempool queries are handled directly
app.get('/chains/main/mempool/monitor_operations', function (req, res) {
    http.get('http://localhost:8732/chains/main/mempool/monitor_operations', function (resp) {
        res.setHeader('Content-Type', 'application/json');
        res.removeHeader("Connection");
        // A chunk of data has been received.
        resp.on('data', function (chunk) {
            console.log("Using the flashbake middleware for operation injection, seems broken");
            console.log(chunk.toString());
            res.write(chunk);
        });
        // octez has ended the response (because a new head has been validated)
        resp.on('end', function () {
            res.end();
        });
    }).on("error", function (err) {
        console.log("Error: " + err.message);
    });
});
//every query except mempool is directly proxied to the node
app.use('/*', mempoolProxy);
//
var server = app.listen(port, function () {
    console.log("Flashbake relay and endpoint listening at http://localhost:" + port);
});
server.setTimeout(500000);
