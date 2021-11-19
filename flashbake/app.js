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
var blake = require('blakejs');
var app = (0, express_1.default)();
var port = 10732;
var mempoolProxy = (0, http_proxy_middleware_1.createProxyMiddleware)({
    target: 'http://localhost:8732',
    changeOrigin: false
});
// The flashbake mempool. We push/pop operations from it.
var flashbakePool = [];
// URL where this daemon receives operations to be directly injected, bypassing mempool
app.post('/flashbake_injection/operation', bodyParser.text({ type: "*/*" }), function (req, res) {
    var transaction = JSON.parse(req.body);
    console.log("flashbake hex-encoded transaction received from client:");
    console.log(transaction);
    console.log("pushing into flashbake special mempool");
    flashbakePool.push(transaction);
    // the client expects the transaction hash to be immediately returned
    console.log("transaction hash:");
    var opHash = (0, utils_1.encodeOpHash)(JSON.parse(req.body));
    console.log(opHash);
    res.json(opHash);
});
// a function that takes a hex-encoded transaction received from a tezos client
// and converts it into binary that the baker expects from the /mempool/monitor_operations
// endpoint.
// This was reverse-engineered by comparing the transaction hex format
// showing when sending a transaction with tezos-client -l (which shows
// all rpc requests) and the same transaction visible from 
// curl -s  --header "accept: application/octet-stream"  http://localhost:8732/chains/main/mempool/monitor_operations | xxd -p 
// Note that this mempool format is not parseable by tezos-codec
function convertTransactionToMempoolBinary(transaction) {
    var binaryClientTransaction = Buffer.from(transaction, 'hex');
    var binaryClientTransactionBranch = binaryClientTransaction.slice(0, 32);
    var binaryClientTransactionContentsAndSignature = binaryClientTransaction.slice(32);
    // let's compose a binary transaction in mempool format.
    // First, we start with these bytes
    var binaryMempoolTransaction = Buffer.from("000000c9", 'hex');
    // Then we add the blake hash of the operation (this is not present in the transaction sent from client, not sure why it's here)
    var transactionBlakeHash = blake.blake2b(binaryClientTransaction, null, 32);
    console.log("Blake hash of transaction: ");
    console.log(JSON.stringify(transactionBlakeHash));
    console.log("Binary Transaction branch:");
    console.log(JSON.stringify(binaryClientTransactionBranch));
    console.log("Binary Transaction contents and signature:");
    console.log(JSON.stringify(binaryClientTransactionContentsAndSignature));
    binaryMempoolTransaction = Buffer.concat([binaryMempoolTransaction, transactionBlakeHash]);
    binaryMempoolTransaction = Buffer.concat([binaryMempoolTransaction, Buffer.from("00000020", 'hex')]);
    binaryMempoolTransaction = Buffer.concat([binaryMempoolTransaction, binaryClientTransactionBranch]);
    binaryMempoolTransaction = Buffer.concat([binaryMempoolTransaction, Buffer.from("00000078", 'hex')]);
    binaryMempoolTransaction = Buffer.concat([binaryMempoolTransaction, binaryClientTransactionContentsAndSignature]);
    binaryMempoolTransaction = Buffer.concat([binaryMempoolTransaction, Buffer.from("000000050500000000", 'hex')]);
    return binaryMempoolTransaction;
}
// the baker queries the node's mempool in binary format (important)
var octezMempoolRequestOpts = {
    hostname: '127.0.0.1',
    port: 8732,
    path: '/chains/main/mempool/monitor_operations',
    headers: { 'accept': 'application/octet-stream' }
};
// mempool queries are handled directly
app.get('/chains/main/mempool/monitor_operations', function (req, res) {
    http.get(octezMempoolRequestOpts, function (resp) {
        res.removeHeader("Connection");
        // A chunk of data has been received.
        resp.on('data', function (chunk) {
            console.log("Received the following from node's mempool:");
            console.log(JSON.stringify(chunk));
            if (flashbakePool.length > 0) {
                console.log("Found a transaction in flashbake special mempool, injecting it");
                // FIXME: must convert json to binary
                var binaryTransactionToInject = convertTransactionToMempoolBinary(flashbakePool[0]);
                console.log("Transaction to inject: " + JSON.stringify(binaryTransactionToInject));
                res.write(binaryTransactionToInject);
            }
            console.log("Injecting");
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
