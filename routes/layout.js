import { Router } from "express";
import { userHasAccess } from "../wiki/wikiStore.js";
import moment from "moment-timezone";

import util from "../util/util.js";
import config from "../config.js";
import language from "../model/language.js";
import { osmbcMarkdown } from "../util/md_util.js";
import configModule from "../model/config.js";
import firstDraft from "../model/firstDraft.js";

import { getNavbarBlogs } from "../model/navbarBlogs.js";
import { getAvatar as _getAvatar } from "../model/user.js";

import _debug from "debug";
const router        = Router();


const htmlRoot      = config.htmlRoot();
const appName       = config.getValue("AppName", { mustExist: true });
const debug = _debug("OSMBC:routes:layout");


const url = config.getValue("url");

function calculateUnreadMessages(list, user) {
  let result = 0;
  for (let k = 0; k < list.length; k++) {
    const a = list[k];
    if (a.commentRead && a.commentRead[user] >= a.commentList.length - 1) continue;
    result += 1;
  }
  return result;
}

const layoutConst = {
  htmlroot: htmlRoot,
  url: url,
  moment: moment,
  util: util,
  appName: appName,
  osmbc_version: (process.env.NODE_ENV !== "test") ? config.version : "T.V.S",
  title: appName,
  auth: config.getValue("auth", { mustExist: true }),
  // Additional stylesheet loaded on top of the regular one, e.g. to mark
  // a non-production instance (beta) with a visible color/banner.
  extraStyle: config.getValue("extraStyle")
};




// Menu bar data for one user from the shared navbar blogs
// (model/navbarBlogs.js): the blog lists (copies, the blogs themselves are
// shared and read only), the unread mention counts for the Inbox badges,
// the user's mentions per blog for the Inbox page, the languages in use.
function navbarDataFor(user, blogs) {
  const mainLang = user.getMainLang();
  const usedLanguages = {};
  if (user.language) usedLanguages[user.language] = true;
  for (const blog of [...blogs.open, ...blogs.edit]) {
    for (const k in blog._usedLanguages) usedLanguages[k] = true;
  }
  const listOfOpenBlog = blogs.open.slice();
  const listOfEditBlog = blogs.edit.filter((blog) => !blog["reviewComment" + mainLang]);
  const listOfReviewBlog = blogs.edit.filter((blog) => blog["reviewComment" + mainLang] && !blog["close" + mainLang]);

  const mentions = new Map();
  let userMentions = 0;
  let mainLangMentions = 0;
  let secondLangMentions = 0;
  for (const blog of [...listOfOpenBlog, ...listOfEditBlog, ...listOfReviewBlog]) {
    const m = blog.mentionsFor(user);
    mentions.set(blog.name, m);
    userMentions += calculateUnreadMessages(m.userMention, user.OSMUser);
    mainLangMentions += calculateUnreadMessages(m.mainLangMention, user.OSMUser);
    secondLangMentions += calculateUnreadMessages(m.secondLangMention, user.OSMUser);
  }
  const empty = { userMention: [], mainLangMention: [], secondLangMention: [] };
  return {
    usedLanguages,
    listOfOpenBlog,
    listOfEditBlog,
    listOfReviewBlog,
    editBlog: blogs.edit.slice(),
    tbc: blogs.tbc,
    tbcOwnArticleNumber: blogs.tbc.mentionsFor(user).tbcOwnArticleNumber,
    userMentions,
    mainLangMentions,
    secondLangMentions,
    mentionsOf: (blog) => mentions.get(blog.name) || empty
  };
}

function prepareRenderLayout(req, res, next) {
  debug("prepareRenderLayout");




  // Variables for rendering purposes

  let style = "/stylesheets/style.css";
  if (req.query.tempstyleOff === "true") req.session.tempstyle = true;
  if (req.query.tempstyleOff === "false") delete req.session.tempstyle;
  if (!req.session.tempstyle && config.getValue("style")) style = config.getValue("style");




  const languages = language.getLid();

  getNavbarBlogs(function (err, blogs) {
    if (err) {
      debug(JSON.stringify(err));
      return next(err);
    }
    const result = navbarDataFor(req.user, blogs);
    const usedLanguages = result.usedLanguages;
    // Small screens (below Bootstrap's lg breakpoint) work in one language,
    // see the osmbc_view cookie set in layout.pug.
    const mobileView = /(?:^|;\s*)osmbc_view=mobile(?:;|$)/.test((req.headers && req.headers.cookie) || "");
    const mobileLang = req.user.getMobileLang();
    req.mobileView = mobileView;
    if (mobileView) usedLanguages[mobileLang] = true;
    const activeLanguages = [];
    languages.forEach(function(item) {
      if (usedLanguages[item]) activeLanguages.push(item);
    });
    // choice for the mobile language: the active languages and the user's own
    const ownLanguages = [req.user.getMainLang(), req.user.getSecondLang(), req.user.getLang3(), req.user.getLang4()].concat(req.user.getLanguages() || []);
    const mobileLanguages = languages.filter((item) => usedLanguages[item] || ownLanguages.indexOf(item) >= 0);
    const markdown = osmbcMarkdown({ target: "editor" });

    const manyTranslationEnabled = config.getValue("manyTranslationEnabled", { default: true }) !== false;
    const blogTranslationVisibleFor = config.getValue("blogTranslationVisibleFor");
    const firstDraftVisible = firstDraft.isVisibleFor(req.user);
    const helpMenu = configModule.getConfig("helpmenu");
    const wikiConfig = config.getWikiConfig();
    const wikiReadable = !!wikiConfig && userHasAccess(wikiConfig.readAccess, req.user);
    const exportProfilesRaw = config.getValue("ExportProfiles", { mustExist: true });
    const exportProfiles = Object.keys(exportProfilesRaw)
      .filter((name) => exportProfilesRaw[name].guiEnabled === true)
      .map((name) => {
        const profile = exportProfilesRaw[name];
        return {
          name: name,
          label: profile.guiLabel || name,
          langMode: profile.guiLangMode || "single",
          order: profile.guiOrder || 999
        };
      })
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.label.localeCompare(b.label);
      });

    if (!(res.rendervar) || typeof (res.rendervar) === "undefined") res.rendervar = {};

    res.rendervar.layout = Object.assign({}, layoutConst, {
      user: req.user,
      languages: languages,
      userMentions: result.userMentions,
      mainLangMentions: result.mainLangMentions,
      secondLangMentions: result.secondLangMentions,
      mentionsOf: result.mentionsOf,
      tbcOwnArticleNumber: result.tbcOwnArticleNumber,
      listOfOpenBlog: result.listOfOpenBlog,
      listOfEditBlog: result.listOfEditBlog,
      listOfReviewBlog: result.listOfReviewBlog,
      editBlog: result.editBlog,
      tbc: result.tbc,
      activeLanguages: activeLanguages,
      mobileView: mobileView,
      mobileLang: mobileLang,
      mobileLanguages: mobileLanguages,
      style: style,
      helpMenu: helpMenu,
      wikiReadable: wikiReadable,
      user_locale: language.momentLocale((req.user.language) ? req.user.language : req.user.getMainLang()),
      language_locale: language.momentLocale(req.user.getMainLang()),
      language2_locale: language.momentLocale(req.user.getSecondLang()),
      md_renderInline: (text) => markdown.renderInline(text ?? ""),
      mentions: util.mentions,
      getAvatar: _getAvatar,
      manyTranslationEnabled: manyTranslationEnabled,
      blogTranslationVisibleFor: blogTranslationVisibleFor,
      firstDraftVisible: firstDraftVisible,
      exportProfiles: exportProfiles
    });
    next();
  });
}




// And configure router to set the prepare Function
router.get("/{*path}", prepareRenderLayout);


router.layoutConst = layoutConst;
router.prepareRenderLayout = prepareRenderLayout;

export default router;
