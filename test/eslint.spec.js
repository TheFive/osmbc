"use strict";


var lint = require("mocha-eslint");


lint(["model"], {formatter:"stylish"});
lint(["notification"], {formatter:"stylish"});
lint(["render"], {formatter:"stylish"});
lint(["routes"], {formatter:"stylish"});
lint(["views"], {formatter:"stylish"});

