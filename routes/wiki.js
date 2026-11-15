// Connects the wiki module (wiki/) to OSMBC: login and roles, layout,
// Markdown settings and logging. The module itself has no OSMBC imports.

import config from "../config.js";
import auth from "./auth.js";
import layoutRouter from "./layout.js";
import { osmbcMarkdown } from "../util/md_util.js";
import { WikiStore } from "../wiki/wikiStore.js";
import { createWikiRouter } from "../wiki/wikiRouter.js";

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
    prepareLayout: layoutRouter.prepareRenderLayout
  });
  router.wikiStore = store;
  return router;
}
