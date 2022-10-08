"use strict";

/* eslint-disable quotes */
const express = require('express');
const app = express();
const path = require("path");
const http = require("http");
const https = require("https");
const fs = require("fs");

const config = require("./config.js");

const PORT = 3032;
const serveIndex = require('serve-index');



app.use(express.static(path.join(__dirname, "public")));

app.use("/", express.static(path.join(__dirname, "test")));
app.use('/', serveIndex(path.join(__dirname, '/test')));

let httpServer = http;
const options = {};
if (config.getServerKey()) {
  httpServer = https;
  options.key = fs.readFileSync(config.getServerKey());
  options.cert = fs.readFileSync(config.getServerCert());
}

const server = httpServer.createServer(options, app);
try {
  server.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));
} catch (err) {
  console.error(err);
}


