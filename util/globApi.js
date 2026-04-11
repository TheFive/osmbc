import { glob } from "glob";

const globApi = {
  async match(pattern, options = {}) {
    return glob(pattern, options);
  }
};

export default globApi;
