

import debug from "debug";
import config from "../config.js";
import fs from "fs";
import path from "path";
import pug from "pug";
import userModule from "../model/user.js";
import sanitize from "sanitize-html";


/**
 * Writes the static public profile page `<OSMUser>.html` into the profile
 * directory, or removes it when the user has no public profile.
 * @param {string} osmUser - OSM user name of the profile owner.
 * @param {function(Error=)} callback - Called when the file is written or removed.
 */
export function generateUserPage(osmUser, callback) {
  debug("generateUserPage");

  userModule.findOne({ OSMUser: osmUser }, function(err, user) {
    if (err) return callback(err);

    const filePath = config.getProfileDir();
    const fileName = path.join(filePath, osmUser + ".html");
    if (!fs.existsSync(filePath)) fs.mkdirSync(filePath, { recursive: true });

    // in case of forbidden public profile, remove it
    if (user.publicProfile !== "Yes") {
      try {
        fs.unlinkSync(fileName);
      } catch (err) {
      }
      return callback();
    }
    // generate public profile
    const html = sanitize(user.publicHtml, {
      allowedTags: sanitize.defaults.allowedTags.concat(["img"]),
      allowedAttributes: {
        a: ["href", "name", "target", "rel"],
        img: ["src", "srcset", "alt", "title", "width", "height", "loading"]
      }
    });

    const fileData = pug.renderFile(path.join(config.getDirName(), "views", "publicProfile.pug"),
      {
        osmUser: osmUser,
        html: html
      }
    );
    try {
      fs.writeFileSync(fileName, fileData, { flag: "w" });
    } catch (err) {
      return callback(err);
    }
    return callback();
  });
}

