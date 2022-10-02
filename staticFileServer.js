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


app.use("/bower_components/bootstrap", express.static(path.join(__dirname, "/node_modules/bootstrap")));
app.use("/bower_components/bootstrap-select", express.static(path.join(__dirname, "/node_modules/bootstrap-select")));
app.use("/bower_components/font-awesome", express.static(path.join(__dirname, "/node_modules/font-awesome")));
app.use("/bower_components/jquery", express.static(path.join(__dirname, "/node_modules/jquery")));
app.use("/bower_components/d3", express.static(path.join(__dirname, "/node_modules/d3")));
app.use("/bower_components/markdown-it", express.static(path.join(__dirname, "/node_modules/markdown-it")));
app.use("/bower_components/markdown-it-imsize", express.static(path.join(__dirname, "/node_modules/markdown-it-imsize")));
app.use("/bower_components/markdown-it-sup", express.static(path.join(__dirname, "/node_modules/markdown-it-sup")));
app.use("/bower_components/markdown-it-emoji", express.static(path.join(__dirname, "/node_modules/markdown-it-emoji")));
app.use("/bower_components/moment", express.static(path.join(__dirname, "/node_modules/moment")));
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


