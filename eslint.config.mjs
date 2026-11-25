import next from "eslint-config-next";
import { uiTextPlugin } from "./scripts/checks/ui-text-lint.mjs";

// UI text comes only from src/i18n (scanned by tests/forbidden-terms.test.js, PRODUCT.md §5).
const TEXT_PROPS =
  "/^(aria-(label|description|roledescription|valuetext|placeholder)|title|placeholder|alt|label|value|defaultValue)$/";
const TEXT = ":matches(Literal[value=/\\p{L}/u], TemplateLiteral)";
const message = "UI text must come from src/i18n.";

const config = [
  { ignores: [".next/**", "node_modules/**"] },
  { linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "off" } },
  ...next,
  {
    files: ["**/*.{js,jsx,mjs}"],
    rules: {
      "react/jsx-no-literals": ["error", { noStrings: true, ignoreProps: true }],
      "react/no-danger": "error",
      "no-restricted-syntax": [
        "error",
        { selector: `JSXAttribute[name.name=${TEXT_PROPS}] ${TEXT}`, message },
        { selector: `:matches(JSXElement, JSXFragment) > JSXExpressionContainer ${TEXT}:not(JSXAttribute *)`, message },
        { selector: `JSXAttribute :matches(JSXElement, JSXFragment) > JSXExpressionContainer ${TEXT}`, message },
        {
          selector: `:matches(VariableDeclarator[id.name="metadata"], FunctionDeclaration[id.name="generateMetadata"]) ${TEXT}`,
          message,
        },
      ],
    },
  },
  {
    // Text that reaches the page without passing the rules above is still checked like the catalogue.
    files: ["app/**/*.{js,jsx,mjs}", "src/**/*.{js,jsx,mjs}"],
    ignores: ["src/i18n/**"],
    plugins: { "ui-text": uiTextPlugin },
    rules: { "ui-text/literal-text": "error" },
  },
];

export default config;
