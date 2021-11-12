"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var utils_1 = require("@taquito/utils");
var bodyParser = require('body-parser');
var app = (0, express_1.default)();
var port = 10732;
app.use(bodyParser.text({ type: "*/*" }));
app.post('/injection/operation', function (req, res) {
    console.log("transaction received:");
    console.log(JSON.parse(req.body));
    console.log("transaction hash:");
    var opHash = (0, utils_1.encodeOpHash)(JSON.parse(req.body));
    console.log(opHash);
    res.json(opHash);
});
app.listen(port, function () {
    console.log("Example app listening at http://localhost:" + port);
});
