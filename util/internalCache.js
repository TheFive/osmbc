
const NodeCache = require("node-cache");
const fs = require("fs");
const path = require("path");


const cacheDir  = path.join(__dirname, "..", "cache");

function createDir(dir, callback) {
  if (fs.existsSync(dir)) return callback();
  console.dir(dir);
  return fs.mkdir(dir, callback);
}

class InternalCache {
  constructor(options) {
    const config = {};
    if (options && options.stdTTL) config.stdTTL = options.stdTTL;
    if (options && options.checkperiod) config.checkperiod = options.checkperiod;

    this.cache = new NodeCache(config);
    this.cacheFile = path.join(cacheDir, options.file);
    this.cacheLoaded = false;
  }

  _storeCache() {
    const self = this;
    function storeCacheFunction() {
      const keys = self.cache.keys();
      const dump = self.cache.mget(keys);
      const dumpstring = JSON.stringify(dump);
      createDir(cacheDir, function writeData() {
        fs.writeFile(self.cacheFile, dumpstring, (err) => {
          if (err) {
            throw err;
          }
        });
      });
    }
    // Wait 1 second to first return result and give timeslot to frontend
    setTimeout(storeCacheFunction, 1000);
  }

  _readCache() {
    if (this.cacheLoaded) return;
    try {
      const dumpstring = fs.readFileSync(this.cacheFile);
      const dump = JSON.parse(dumpstring);
      for (const k in dump) {
        this.cache.set(k, dump[k]);
      }
      this.cacheLoaded = true;
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }

  get(key) { this._readCache(); return this.cache.get(key); }
  set(key, value) { this.cache.set(key, value); this._storeCache(); }
}

module.exports = InternalCache;
