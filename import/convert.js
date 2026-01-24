import async from "async";
import ProgressBar from "progress";

import articleModule from "../model/article.js";
import userModule from "../model/user.js";
import blogModule from "../model/blog.js";
import logModule from "../model/logModule.js";
import configModule from "../model/config.js";
import config from "../config.js";

const { logger } = config;

config.initialise();

const blogs = {};
const articlesMap = {};

async.series(
  [
    configModule.initialise,

    function articles(done) {
      articleModule.find({}, (err, result) => {
        if (err) {
          logger.error(err);
          return;
        }

        if (result) {
          const length = result.length;
          const progress = new ProgressBar(
            "Converting Articles :bar :percent",
            { total: length }
          );

          let count = 0;

          async.eachSeries(
            result,
            (item, cb) => {
              articlesMap[item.id] = item;
              const save = false;

              // place convert code here

              progress.tick();
              if (save) {
                count++;
                item.save(cb);
              } else {
                cb();
              }
            },
            () => {
              console.info();
              console.info(`${count} from ${length} Article changed`);
              done();
            }
          );
        }
      });
    },

    function users(done) {
      userModule.find({}, (err, result) => {
        if (err) {
          console.error(err);
          return;
        }

        if (result) {
          const length = result.length;
          const progress = new ProgressBar(
            "Converting Users :bar :percent",
            { total: length }
          );

          let count = 0;

          async.eachSeries(
            result,
            (item, cb) => {
              const save = false;

              // place convert code here

              progress.tick();
              if (save) {
                count++;
                item.save(cb);
              } else {
                cb();
              }
            },
            () => {
              console.info();
              console.info(`${count} from ${length} Users changed`);
              done();
            }
          );
        }
      });
    },

    function blog(done) {
      blogModule.find({}, (err, result) => {
        if (err) {
          console.error(err);
          return;
        }

        if (result) {
          const length = result.length;
          const progress = new ProgressBar(
            "Converting Blog :bar :percent",
            { total: length }
          );

          let count = 0;

          async.eachSeries(
            result,
            (item, cb) => {
              blogs[item.id] = item;
              const save = false;

              // place convert code here

              progress.tick();
              if (save) {
                count++;
                item.save(cb);
              } else {
                cb();
              }
            },
            () => {
              console.info();
              console.info(`${count} from ${length} Blogs changed`);
              done();
            }
          );
        }
      });
    },

    function changes(done) {
      logModule.find({}, (err, result) => {
        if (err) {
          console.error(err);
          return;
        }

        if (result) {
          const length = result.length;
          const progress = new ProgressBar(
            "Converting Changes :bar :percent",
            { total: length }
          );

          let count = 0;

          async.eachSeries(
            result,
            (item, cb) => {
              let save = false;

              // place convert code here

              if (typeof item.user === "object" && item.user?.OSMUser) {
                item.user = item.user.OSMUser;
                save = true;
              }

              progress.tick();
              if (save) {
                count++;
                item.save(cb);
              } else {
                cb();
              }
            },
            () => {
              console.info();
              console.info(`${count} from ${length} Changes changed`);
              done();
            }
          );
        }
      });
    }
  ],
  (err) => {
    if (err) console.error(err);
    console.info("READY.");
  }
);
