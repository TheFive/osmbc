// Connects the wiki module (wiki/) to OSMBC: login and roles, layout,
// Markdown settings and logging. The module itself has no OSMBC imports.

import config from "../config.js";
import auth from "./auth.js";
import layoutRouter from "./layout.js";
import { osmbcMarkdown } from "../util/md_util.js";
import { WikiStore } from "../wiki/wikiStore.js";
import { createWikiRouter } from "../wiki/wikiRouter.js";
import { createWikiNotifier } from "../wiki/wikiNotify.js";
import SlackAPI from "../notification/SlackAPI.js";

// Mattermost message integration: the hook of wiki.mattermost.team from
// the slacktool config, the channel from wiki.mattermost.channel
function createOsmbcNotifier(settings) {
  if (!settings || settings.mode === "off") return createWikiNotifier(null, { logger: config.logger });
  const hooks = config.getValue("slacktool") || {};
  const hook = hooks[settings.team];
  if (!hook) {
    config.logger.error("Wiki: no slacktool hook for wiki.mattermost.team '" + settings.team + "', messages are off");
    return createWikiNotifier(null, { logger: config.logger });
  }
  const slack = new SlackAPI(hook);
  const siteUrl = config.getValue("url") || "";
  return createWikiNotifier(settings, {
    send: (message) => slack.send(message),
    siteUrl,
    botName: (config.getValue("AppName") || "osmbc").toLowerCase(),
    iconUrl: siteUrl + config.htmlRoot() + "/images/osmbc_im_logo.png",
    logger: config.logger
  });
}

// returns null if the wiki is off (no wiki.directory in the config)
export function createOsmbcWikiRouter(wikiConfig = config.getWikiConfig()) {
  if (!wikiConfig) return null;
  const store = new WikiStore({
    directory: wikiConfig.directory,
    autoPush: wikiConfig.autoPush,
    logger: config.logger
  });
  store.init().then(
    () => config.logger.info("Wiki: using " + wikiConfig.directory),
    (err) => config.logger.error("Wiki: " + err.message)
  );
  const router = createWikiRouter({
    store,
    wikiConfig,
    checkRole: (roles) => auth.checkRole(roles),
    createMarkdown: () => osmbcMarkdown(),
    basePath: config.htmlRoot() + "/wiki",
    prepareLayout: layoutRouter.prepareRenderLayout,
    onChange: createOsmbcNotifier(wikiConfig.mattermost)
  });
  router.wikiStore = store;
  return router;
}
