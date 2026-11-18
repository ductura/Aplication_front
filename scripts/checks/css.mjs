// CSS modules use only tokens from app/globals.css (Ductus DESIGN-SYSTEM.md §3, §5; D-185).
const KEYWORDS =
  /^(solid|dashed|dotted|double|none|hidden|transparent|currentcolor|inherit|initial|unset|inset|auto|no-repeat|repeat|cover|contain|center|top|bottom|left|right|to|at|circle|ellipse|underline|overline|line-through|wavy)$/i;
const COLOR_PROPS =
  /^(color|background(-color)?|border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-color)?|outline(-color)?|fill|stroke|(box|text)-shadow|text-decoration(-color)?|caret-color|accent-color|column-rule(-color)?|--[\w-]+)$/i;
const RULES = [
  [/./, (v) => /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/i.test(v)],
  [
    COLOR_PROPS,
    (v) => v.replace(/var\([^)]*\)/g, "").split(/[\s,/]+/).some((w) => /^[a-z-]+$/i.test(w) && !KEYWORDS.test(w)),
  ],
  [/^outline/i, (v) => /\d|\b(thin|medium|thick)\b/i.test(v.replace(/var\(--[\w-]+\)/g, ""))],
  [/radius/i, (v) => !/^(var\(--[\w-]+\)|999px|50%)$/.test(v)],
  [/^content$/i, (v) => !/^(""|''|none)$/.test(v)],
];

export function checkModuleCss(css) {
  const declarations = [...css.matchAll(/\{([^{}]*)\}/g)].flatMap((b) => [...b[1].matchAll(/(--[\w-]+|[\w-]+)\s*:\s*([^;]+)/g)]);
  return declarations.flatMap(([, prop, raw]) =>
    RULES.filter(([p, bad]) => p.test(prop) && bad(raw.trim())).map(() => `${prop}: ${raw.trim()}`),
  );
}
