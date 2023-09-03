

/* eslint-disable quotes */
import express from 'express';
import path from "path";
import http from "http";
import https from "https";
import fs from "fs";

import config from "./config.js";
import serveIndex from 'serve-index';
const app = express();

const PORT = 3032;



app.use(express.static(path.join(config.getDirName(), "public")));

app.use("/", express.static(path.join(config.getDirName(), "test")));
app.use('/', serveIndex(path.join(config.getDirName(), '/test')));

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
  console.log("Open Test Html with https://localhost:" + PORT);
} catch (err) {
  console.error("Error occured in Listen Loop");
  console.error(err);
}


