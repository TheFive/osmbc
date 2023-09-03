
import NodeCache from "node-cache";
import { existsSync, mkdir, writeFile, readFileSync } from "fs";
import { join } from "path";
import config from "../config.js";


const cacheDir  = join(config.getDirName(), "..", "cache");

function createDir(dir, callback) {
  if (existsSync(dir)) return callback();
  console.dir(dir);
  return mkdir(dir, callback);
}

class InternalCache {
  constructor(options) {
    const config = {};
    if (options && options.stdTTL) config.stdTTL = options.stdTTL;
    if (options && options.checkperiod) config.checkperiod = options.checkperiod;

    this.cache = new NodeCache(config);
    this.cacheFile = join(cacheDir, options.file);
    this.cacheLoaded = false;
  }

  _storeCache() {
    const self = this;
    function storeCacheFunction() {
      const keys = self.cache.keys();
      const dump = self.cache.mget(keys);
      const dumpstring = JSON.stringify(dump);
      createDir(cacheDir, function writeData() {
        writeFile(self.cacheFile, dumpstring, (err) => {
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
      const dumpstring = readFileSync(this.cacheFile);
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

export default InternalCache;
