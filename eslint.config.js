import globals from "globals";
import mochaPlugin from "eslint-plugin-mocha";
import jsdoc from "eslint-plugin-jsdoc";

// application code, without tests and developer tools
const appFiles = [
  "app.js", "config.js", "bin/**/*.js", "export/**/*.js", "genstaticpage/**/*.js", "import/**/*.js",
  "model/**/*.js", "notification/**/*.js", "render/**/*.js", "routes/**/*.js", "util/**/*.js",
  "wiki/**/*.js", "wp-reconcile/**/*.js", "public/javascripts/**/*.js"
];

export default [
  {
    ignores: ["node_modules/**", "coverage/**", "public/javascripts/*.min.js", "**/bootstrap*.js", "**/jquery*.js", "**/moment*.js", "**/markdown*.js"]
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off"
    }
  },
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.jquery,
        ...globals.mocha,
        ...globals.node
      }
    },
    rules: {
      quotes: [2, "double", { avoidEscape: true, allowTemplateLiterals: true }],
      semi: [2, "always"],
      "no-multi-spaces": [2, { exceptions: { VariableDeclarator: true } }],
      "no-multiple-empty-lines": 0,
      "no-trailing-spaces": 2,
      "space-before-function-paren": 0,
      "space-in-parens": [2, "never"],
      "object-curly-spacing": [2, "always"],
      "no-multi-str": 0,
      "object-shorthand": 0,
      "new-cap": [2, { newIsCapExceptions: ["moment"], capIsNewExceptions: ["True", "Router", "False"] }],
      "no-useless-escape": 0,
      "default-case-last": 2,
      "no-useless-backreference": 2,
      "no-loss-of-precision": 2,
      "no-unreachable-loop": 2
    }
  },
  {
    // Readability: keep functions small enough to understand without help.
    // Existing violations are listed in eslint-suppressions.json, so only
    // new ones fail. See docs/development.md "Lint rules for readability".
    files: appFiles,
    plugins: { jsdoc },
    rules: {
      complexity: ["error", 15],
      "max-depth": ["error", 4],
      "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }],
      "max-params": ["error", 5],
      // exported functions, classes and methods get a JSDoc comment
      "jsdoc/require-jsdoc": ["error", {
        publicOnly: { esm: true, cjs: false },
        require: { FunctionDeclaration: true, ClassDeclaration: true, MethodDefinition: true },
        checkConstructors: false,
        checkGetters: false,
        checkSetters: false
      }],
      // a JSDoc comment that exists must match the code
      "jsdoc/check-param-names": "error",
      "jsdoc/check-tag-names": "error"
    }
  },
  {
    files: ["test/**/*.js"],
    plugins: {
      mocha: mochaPlugin
    },
    rules: {
      "mocha/no-exclusive-tests": "error",
      "mocha/no-skipped-tests": 0,
      "mocha/no-pending-tests": 0,
      "mocha/handle-done-callback": 0,
      "mocha/no-synchronous-tests": 0,
      "mocha/no-global-tests": 0,
      "mocha/no-return-and-callback": 0,
      "mocha/valid-test-title": 0,
      "mocha/valid-suite-title": 0,
      "mocha/no-sibling-hooks": 0,
      "mocha/no-mocha-arrows": 0,
      "mocha/no-hooks": 0,
      "mocha/no-hooks-for-single-case": 0,
      "mocha/no-top-level-hooks": 0,
      "mocha/no-identical-title": 0,
      "mocha/max-top-level-suites": 0,
      "mocha/no-nested-tests": 0
    }
  },
  {
    files: ["public/javascripts/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.jquery
      }
    }
  }
];