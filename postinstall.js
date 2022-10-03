"use strict";


const fs = require("fs");
const path = require("path");



function copy(srcpath, destpath) {
  const src = path.join(__dirname, "node_modules", srcpath);
  const dest = path.join(__dirname, "public", destpath);
  fs.copyFileSync(src, dest);
}




copy("/bootstrap/dist/css/bootstrap.min.css", "/stylesheets/bootstrap.min.css");
copy("/bootstrap/dist/js/bootstrap.bundle.min.js", "/javascripts/bootstrap.bundle.min.js");

copy("/jquery/dist/jquery.min.js", "/javascripts/jquery.min.js");

copy("/bootstrap-select/dist/css/bootstrap-select.min.css", "stylesheets/bootstrap-select.min.css");
copy("/bootstrap-select/dist/js/bootstrap-select.min.js", "/javascripts/bootstrap-select.min.js");

copy("/font-awesome/css/font-awesome.min.css", "stylesheets/font-awesome.min.css");

copy("/markdown-it/dist/markdown-it.min.js", "javascripts/markdown-it.min.js");
copy("/markdown-it-imsize/dist/markdown-it-imsize.min.js", "javascripts/markdown-it-imsize.min.js");
copy("/markdown-it-sup/dist/markdown-it-sup.min.js", "javascripts/markdown-it-sup.min.js");
copy("/markdown-it-emoji/dist/markdown-it-emoji.min.js", "javascripts/markdown-it-emoji.min.js");


copy("/moment/min/moment.min.js", "/javascripts/moment.min.js");


