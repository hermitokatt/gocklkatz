import next from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

/**
 * Lints the landing page only. The repository harness (tools/, tests/) is plain shell and Node
 * checked by its own self-tests; pulling it into the app's Next config would make this app's
 * gate the owner of files that are not part of the app.
 */
const config = [
  {
    ignores: [
      ".depot/**",
      ".github/**",
      ".next/**",
      "apps/**",
      "docs/**",
      "node_modules/**",
      "tests/**",
      "tools/**",
      "var/**",
    ],
  },
  ...next,
  ...nextTypescript,
  prettier,
];

export default config;
