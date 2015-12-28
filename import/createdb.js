var config = require('../config.js');

var testutil = require('../test/testutil.js');


config.initialise();
console.log("Creating Database");

testutil.clearDB(function(err)
  { 
    if (err) console.dir(err);
    console.log("Everythings ready");
  }
);



