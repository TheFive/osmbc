import axios from "axios";
import _debug from "debug";

import config from "../config.js";
import InternalCache from "../util/internalCache.js";
import ssrfAgents from "../util/ssrfAgents.js";

const debug = _debug("OSMBC:util:linkCheck");

const userAgent = config.getValue("User-Agent", { mustExist: true });

const linkCache = new InternalCache({ file: "linkExist.cache", stdTTL: 21 * 24 * 60 * 60, checkperiod: 24 * 60 * 60 });


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
    httpAgent: ssrfAgents.httpAgent,
    httpsAgent: ssrfAgents.httpsAgent,
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
