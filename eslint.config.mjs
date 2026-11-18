import next from "eslint-config-next";

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
    files: ["**/*.{js,jsx,mjs,cjs}"],
    rules: {
      "react/jsx-no-literals": ["error", { noStrings: true, ignoreProps: true }],
      "react/no-danger": "error",
      "no-restricted-syntax": [
        "error",
        { selector: `JSXAttribute[name.name=${TEXT_PROPS}] ${TEXT}`, message },
        { selector: `:matches(JSXElement, JSXFragment) > JSXExpressionContainer ${TEXT}:not(JSXAttribute *)`, message },
      ],
    },
  },
];

export default config;
