"use strict";


var lint = require("mocha-eslint");


lint(["model","notification","render","routes","util","public/javascripts"], {formatter:"stylish",timeout:15000,debug:true});

