// Split of the configuration into a technical part (server, database,
// secrets - managed by the server admin, e.g. with Ansible) and an
// editorial part (languages, export, workflow - managed by the editorial
// team). config.js merges both at start, tools/split-config.mjs splits an
// existing single file. No imports of config.js here, this module is used
// before the configuration exists.

// Top level keys of the editorial file. Every other key is technical.
export const editorialKeys = [
  "languages",
  "moment_locale",
  "ExportProfiles",
  "Blog Title For Export",
  "Hugo",
  "link-attributes",
  "copyLanguageFromAnother",
  "blogTranslationVisibleFor",
  "manyTranslationEnabled",
  "DefineRole",
  "allowGuest",
  "createGuestUsersAutomatic",
  "ReviewInWP",
  "urlWoErrorWhileEdit",
  "WelcomeInterval",
  "userIsOldInDays",
  "WelcomeRefreshInSeconds",
  "BlogDurationDays",
  "MaxDiffLength",
  "CalendarDateFormat"
];

// Keys with both kinds of values: these sub keys are technical, all other
// sub keys are editorial.
export const mixedKeys = {
  FirstDraftConfig: ["apiKey"],
  Transition: ["enabled", "scheduleCron", "runOnStart"]
};

// Top level keys the split script knows as technical. Unknown keys also go
// to the technical file (they may hold secrets), but are reported.
export const technicalKeys = [
  "serverport", "serverhostname", "serverkey", "servercert", "url", "htmlroot", "callbackUrl",
  "postgres", "postgresLogStatements",
  "SessionSecret", "SessionName", "cookieMaxAge", "limitValues", "auth", "apiKeys",
  "SMTP", "EmailSender", "AllowedMailAddresses",
  "maillog_directory", "maillog_prefix", "maillog_dateformat",
  "exportlog_directory", "exportlog_prefix", "exportlog_dateformat",
  "cache_directory", "profile_directory", "editorial_config",
  "logInfoTemplate", "User-Agent", "media folder", "Feature Image Base URL",
  "slack", "slacktool", "DeeplProConfig", "blogSyncReplaceMaxBlogNumber",
  "AppName", "style", "extraStyle", "bootstrap", "jquery", "twitter"
];

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// Merges the editorial config into the technical one. Objects are merged
// key by key; a value set in both files is a conflict, so it is always
// clear which file a value comes from. Returns { config, conflicts }.
export function mergeConfigs(technical, editorial) {
  const conflicts = [];
  function merge(target, source, prefix) {
    const result = Object.assign({}, target);
    for (const key of Object.keys(source)) {
      const name = prefix ? prefix + "." + key : key;
      if (!(key in result)) {
        result[key] = source[key];
      } else if (isPlainObject(result[key]) && isPlainObject(source[key])) {
        result[key] = merge(result[key], source[key], name);
      } else {
        conflicts.push(name);
      }
    }
    return result;
  }
  return { config: merge(technical || {}, editorial || {}, ""), conflicts };
}

// Splits a single config into { technical, editorial, unknown }.
// unknown lists the top level keys put into technical without being known.
export function splitConfig(full) {
  const technical = {};
  const editorial = {};
  const unknown = [];
  for (const key of Object.keys(full)) {
    const value = full[key];
    if (editorialKeys.includes(key)) {
      editorial[key] = value;
    } else if (mixedKeys[key] && isPlainObject(value)) {
      for (const sub of Object.keys(value)) {
        const side = mixedKeys[key].includes(sub) ? technical : editorial;
        if (!side[key]) side[key] = {};
        side[key][sub] = value[sub];
      }
    } else {
      if (!technicalKeys.includes(key) && !mixedKeys[key]) unknown.push(key);
      technical[key] = value;
    }
  }
  return { technical, editorial, unknown };
}
