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
var relay_1 = require("@flashbake/relay");
var logTimestamp = require('log-timestamp');
var bodyParser = require('body-parser');
var dump = require('buffer-hexdump');
var blake = require('blakejs');
var app = (0, express_1.default)();
var port = 10732;
var selfAddress = 'tz1THLWsNuricp4y6fCCXJk5pYazGY1e7vGc';
var selfEndpointUrl = "http://localhost:" + port + "/flashbake_injection/operation";
var bakerRegistry = new relay_1.StubRegistryService();
bakerRegistry.setEndpoint(selfAddress, selfEndpointUrl);
var mempoolProxy = (0, http_proxy_middleware_1.createProxyMiddleware)({
    target: 'http://localhost:8732',
    changeOrigin: false
});
// The flashbake mempool. We push/pop operations from it.
var flashbakePool = [];
function getBakingRights() {
    var addresses = new Array();
    console.log('--- in getBakingRights() --- ');
    var bakerRightsRequestOpts = {
        hostname: '127.0.0.1',
        port: 8732,
        path: 'chains/main/blocks/head/helpers/baking_rights?max_priority',
        headers: { 'accept': 'application/json' }
    };
    http.get(bakerRightsRequestOpts, function (resp) {
        var statusCode = resp.statusCode;
        var contentType = resp.headers['content-type'] || '';
        var error;
        if (statusCode !== 200) {
            error = new Error("Baking rights request failed with status code: " + statusCode + ".");
        }
        else if (!/^application\/json/.test(contentType)) {
            error = new Error("Baking rights request produced unexpected response content-type " + contentType + ".");
        }
        if (error) {
            console.error(error.message);
            resp.resume();
            return;
        }
        // A chunk of data has been received.
        var rawData = '';
        resp.on('data', function (chunk) { rawData += chunk; });
        resp.on('end', function () {
            try {
                console.log("Received the following baking rights response from node's mempool:\n" + rawData);
                var bakingRights = JSON.parse(rawData);
                for (var _i = 0, bakingRights_1 = bakingRights; _i < bakingRights_1.length; _i++) {
                    var bakingRight = bakingRights_1[_i];
                    addresses.push(bakingRight.delegate);
                }
            }
            catch (e) {
                if (typeof e === "string") {
                    console.error(e);
                }
                else if (e instanceof Error) {
                    console.error(e.message);
                }
            }
        });
    }).on("error", function (err) {
        console.log("Error while querying baker rights: " + err.message);
    });
    return addresses;
}
// URL where this daemon receives operations to be directly injected, bypassing mempool
app.post('/flashbake_injection/operation', bodyParser.text({ type: "*/*" }), function (req, res) {
    var transaction = JSON.parse(req.body);
    console.log("flashbake hex-encoded transaction received from client:");
    console.log(transaction);
    // Query upcoming baking rights
    var addresses = getBakingRights();
    var endpointUrl = '';
    var _loop_1 = function (address) {
        // TODO: this has synchronization issues resulting in non-deterministic endpointUrl value
        bakerRegistry.getEndpoint(address).then(function (endpoint) {
            if (endpoint) {
                console.log("Found endpoint " + endpoint + " for address " + address + " in flashbake registry.");
                endpointUrl = endpoint;
            }
        });
        if (endpointUrl)
            return "break";
    };
    // Iterate through baking rights to discover the earliest upcoming participating baker
    for (var _i = 0, addresses_1 = addresses; _i < addresses_1.length; _i++) {
        var address = addresses_1[_i];
        var state_1 = _loop_1(address);
        if (state_1 === "break")
            break;
    }
    if (!endpointUrl) {
        console.warn('No flashbake endpoints found for current cycle, using self');
        endpointUrl = selfEndpointUrl;
    }
    if (endpointUrl === selfEndpointUrl) {
        // If earliest upcoming Flashbake participating baker is self, add transaction to local Flashbake pool
        console.log("pushing into flashbake special mempool");
        flashbakePool.push(transaction);
        // the client expects the transaction hash to be immediately returned
        console.log("transaction hash:");
        var opHash = (0, utils_1.encodeOpHash)(JSON.parse(req.body));
        console.log(opHash);
        res.json(opHash);
    }
    else {
        // ...otherwise relay it to that baker via their /flashbake_injection/operation
        var relayReq = http.request(endpointUrl, {
            method: 'POST',
            headers: {
                'User-Agent': 'Flashbake-Relay / 0.0.1',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(req.body)
            }
        }, function (resp) {
            var statusCode = resp.statusCode;
            if (statusCode !== 200) {
                console.error("Relay request to " + endpointUrl + " failed with status code: " + statusCode + ".");
                resp.resume();
            }
            var rawData = '';
            resp.on('data', function (chunk) { rawData += chunk; });
            resp.on('end', function () {
                console.log("Received the following response from relay " + endpointUrl + ":\n" + rawData);
                // forwared response to relay client
                res.write(rawData);
            });
        }).on("error", function (err) {
            console.log("Error while relaying injection to " + endpointUrl + ": " + err.message);
        });
        // relay original request to the remote flashbaker
        relayReq.write(req.body);
        relayReq.end();
    }
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
    var binaryMempoolTransaction = Buffer.from("000000ce000000ca", 'hex');
    // Then we add the blake hash of the operation (this is not present in the transaction sent from client, not sure why it's here)
    var transactionBlakeHash = blake.blake2b(binaryClientTransaction, null, 32);
    console.log("Blake hash of transaction: ");
    console.log(dump(transactionBlakeHash));
    console.log("Binary Transaction branch:");
    console.log(dump(binaryClientTransactionBranch));
    console.log("Binary Transaction contents and signature:");
    console.log(dump(binaryClientTransactionContentsAndSignature));
    binaryMempoolTransaction = Buffer.concat([binaryMempoolTransaction, transactionBlakeHash]);
    binaryMempoolTransaction = Buffer.concat([binaryMempoolTransaction, Buffer.from("00000020", 'hex')]);
    binaryMempoolTransaction = Buffer.concat([binaryMempoolTransaction, binaryClientTransactionBranch]);
    binaryMempoolTransaction = Buffer.concat([binaryMempoolTransaction, Buffer.from("00000078", 'hex')]);
    binaryMempoolTransaction = Buffer.concat([binaryMempoolTransaction, binaryClientTransactionContentsAndSignature]);
    binaryMempoolTransaction = Buffer.concat([binaryMempoolTransaction, Buffer.from("00000006060000008a00", 'hex')]);
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
            console.log(dump(chunk));
            if (flashbakePool.length > 0) {
                console.log("Found a transaction in flashbake special mempool, injecting it");
                var binaryTransactionToInject = convertTransactionToMempoolBinary(flashbakePool[0]);
                console.log("Transaction to inject: \n" + dump(binaryTransactionToInject));
                res.write(binaryTransactionToInject);
                flashbakePool = []; // for now, just empty mempool once one transaction has been injected
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
