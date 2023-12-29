

import debug from "debug";
import config from "../config.js";
import fs from "fs";
import path from "path";
import pug from "pug";
import userModule from "../model/user.js";
import sanitize from "sanitize-html";


export function generateUserPage(osmUser, callback) {
  debug("generateUserPage");

  userModule.findOne({ OSMUser: osmUser }, function(err, user) {
    if (err) return callback(err);

    const filePath = path.join(config.getDirName(), "public", "profile");
    const fileName = path.join(filePath, osmUser + ".html");
    if (!fs.existsSync(filePath)) fs.mkdirSync(filePath);

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

