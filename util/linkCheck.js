import http from "http";
import https from "https";
import ssrfFilter from "ssrf-req-filter";
import axios from "axios";
import _debug from "debug";

import config from "../config.js";
import InternalCache from "../util/internalCache.js";

const debug = _debug("OSMBC:util:linkCheck");

const userAgent = config.getValue("User-Agent", { mustExist: true });

const linkCache = new InternalCache({ file: "linkExist.cache", stdTTL: 21 * 24 * 60 * 60, checkperiod: 24 * 60 * 60 });

// SSRF-filtered agents for the link check, one per protocol. axios
// needs both httpAgent and httpsAgent to be of the matching type, or
// following a redirect that switches protocol (very common: plain http://
// links in old WN issues now redirect to https://) makes Node throw
// `Protocol "https:" not supported. Expected "http:"` and the link gets
// reported as broken even though it's perfectly reachable.
const httpLinkAgent = ssrfFilter.requestFilterHandler(new http.Agent());
const httpsLinkAgent = ssrfFilter.requestFilterHandler(new https.Agent());


// Checks the existence of an absolute url with a HEAD request.
// Calls back with "OK", the HTTP status code (>= 300) or an error message.
// Successful results are cached in linkExist.cache.
function checkUrl(url, callback) {
  debug("checkUrl %s", url);
  if (linkCache.get(url) === "OK") return callback(null, "OK");

  // check wether url is valid
  try {
    // eslint-disable-next-line no-unused-vars
    const testurl = new URL(url);
  } catch (error) {
    return callback(null, `Invalid URI "${url}"`);
  }

  axios.head(url, {
    httpAgent: httpLinkAgent,
    httpsAgent: httpsLinkAgent,
    headers: { "User-Agent": userAgent }
  }).then(function() {
    linkCache.set(url, "OK");
    return callback(null, "OK");
  }).catch(function(err) {
    if (err.code && err.code === "HPE_UNEXPECTED_CONTENT_LENGTH") {
      // www.openstreetmap.com is delivering content_length and transfer encoding, which
      // results node in throwing this error.
      // as the existanc of the url is approved by this error, everything is fine.
      return callback(null, "OK");
    }
    if (err.response && err.response.status >= 300) {
      return callback(null, err.response.status);
    }
    let m = "NOK";
    if (typeof err.message === "string") m = err.message;
    return callback(null, m);
  });
}

function cacheFlushAll() {
  linkCache.flushAll();
}

const linkCheck = {
  checkUrl: checkUrl,
  cacheFlushAll: cacheFlushAll
};

export default linkCheck;
