"use strict";


var lint = require("mocha-eslint");


lint(["model","notification","render","routes","views"], {formatter:"stylish",timeout:5000});

