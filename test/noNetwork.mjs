// Keep the test run off the internet: a request without a nock mock fails
// at once (NetConnectNotAllowedError) instead of reaching the real host.
// Unmocked calls that went out before: the DeepL usage request the admin
// page waits for while rendering, Mattermost webhooks of the test config.
// localhost stays open for the app server and chromedriver.

import nock from "nock";

nock.disableNetConnect();
nock.enableNetConnect(/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/);
