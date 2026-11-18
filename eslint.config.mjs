import next from "eslint-config-next";

// UI text comes only from src/i18n (PRODUCT.md §5 scanner reads the catalogue).
const textProps = "/^(aria-label|aria-description|title|placeholder|alt|label)$/";
const textValue = ":matches(Literal[value=/\\p{L}/u], TemplateLiteral)";
const message = "UI text must come from src/i18n.";

const config = [
  { ignores: [".next/**", "node_modules/**"] },
  ...next,
  {
    files: ["**/*.jsx", "**/*.js"],
    rules: {
      "react/jsx-no-literals": ["error", { noStrings: true, ignoreProps: true }],
      "no-restricted-syntax": [
        "error",
        { selector: `JSXAttribute[name.name=${textProps}] ${textValue}`, message },
        {
          selector: `:matches(JSXElement, JSXFragment) > JSXExpressionContainer > :matches(ConditionalExpression, LogicalExpression) ${textValue}`,
          message,
        },
      ],
    },
  },
];

export default config;
