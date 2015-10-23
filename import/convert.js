
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
      if (item.markdown) {
        item.markdownDE = item.markdown;
        delete item.markdown;
        item.save(cb);
        console.log(count+" out of "+length);
      } else cb();
    })
  }
})