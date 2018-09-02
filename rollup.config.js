import resolve from "rollup-plugin-node-resolve";

import convertToEsModules from "./convert-to-es-modules";
import pkg from "./package.json";

export default [
  {
    input: "./index.es.js",
    output: [
      {
        name: "callbag",
        file: pkg.browser,
        format: "umd"
      },
      { file: pkg.main, format: "cjs" },
      { file: pkg.module, format: "es" }
    ],
    plugins: [resolve(), convertToEsModules()]
  }
];
