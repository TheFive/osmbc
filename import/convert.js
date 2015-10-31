
var articleModule = require('../model/article.js');
var config= require('../config.js');
var async = require('async');

config.initialise();

articleModule.find({},function(err,result){
  if (err) {
    console.log(err);
    return;
  }
  if (result) {
    var length = result.length;
    var count = 0;
    async.eachSeries(result,function iterator (item,cb){
      count ++;
      var save=false;
      if (item.markdown) {
        item.markdownDE = item.markdown;
        delete item.markdown;
        save = true; 
      } 
      if (item.categoryEN) {
        if (item.categoryEN == "-- no category yet --") {
          item.categoryEN = "-- not categorised --";
          save = true;
        }
      }
      if (item.category) {
        item.categoryDE=item.category;
        delete item.category;
        save = true;
      }
      if (item.markdownDE && item.markdownDE == "english only") {
        item.markdownDE = "no translation";
        save = true;
      }
      if (item.markdownEN && item.markdownEN == "german only") {
        item.markdownDE = "no translation";
        save = true;
      }

      console.log(count+" out of "+length);
      if (save) item.save(cb); else cb();
    })
  }
})