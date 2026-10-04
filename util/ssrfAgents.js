import http from "http";
import https from "https";
import ssrfFilter from "ssrf-req-filter";

// SSRF-filtered agents for requests to user supplied urls, one per
// protocol. axios needs both httpAgent and httpsAgent to be of the
// matching type, or following a redirect that switches protocol (very
// common: plain http:// links now redirect to https://) makes Node throw
// `Protocol "https:" not supported. Expected "http:"`.
const httpAgent = ssrfFilter.requestFilterHandler(new http.Agent());
const httpsAgent = ssrfFilter.requestFilterHandler(new https.Agent());

const ssrfAgents = {
  httpAgent: httpAgent,
  httpsAgent: httpsAgent
};

export default ssrfAgents;
