#!/usr/bin/env node
// Writes a config for a test run of the container image (CI job
// container-build, local checks): config.test.yaml with the container's
// paths and database, see docs/container.md.
//
//   node tools/container-test-config.mjs <config.test.yaml> <target.yaml>
//
// The database password is left out on purpose: the container gets it
// from POSTGRES_PASSWORD, like a real installation from a Podman secret.

import fs from "fs";
import { load, dump } from "js-yaml";

const [source, target] = process.argv.slice(2);
if (!source || !target) {
  console.error("usage: node tools/container-test-config.mjs <config.test.yaml> <target.yaml>");
  process.exit(2);
}

const c = load(fs.readFileSync(source, "utf8"));

// TLS is done by the reverse proxy; the wiki stays off.
delete c.serverkey;
delete c.servercert;
delete c.wiki;

c.serverport = 3000;
c.serverhostname = "0.0.0.0";
c.url = "http://localhost:3000";
c.postgres = { server: "osmbc-db", port: "5432", database: "osmbc", username: "osmbc" };
c.cache_directory = "/data/cache";
c.profile_directory = "/data/profile";
c.maillog_directory = "/data/log";
c.exportlog_directory = "/data/log";
c.auth.htaccess.enabled = false;
c.Transition = { enabled: false };

fs.writeFileSync(target, dump(c));
console.info("container test config written to " + target);
