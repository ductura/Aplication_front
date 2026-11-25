// ESLint rule ui-text/literal-text for app/ and src/ except the catalogue src/i18n/hr.js. UI text comes only from the
// catalogue, whatever path it would take to the page: a prop of our own component, a constant shown as
// {label}, an object, a spread or a module outside src/i18n.
//
// 1. A string with a letter is allowed only as a technical token: printable ASCII, no spaces, first letter
//    lower case, and either holding a character other than a letter or hyphen (paths, MIME types, URLs) or
//    being one of the closed list WORDS; or one of the exact values in TECHNICAL. Import
//    sources and directives are exempt. Template literals are read piece by piece; static concatenation
//    and joins of literal arrays are also read whole, so words cannot be glued from technical pieces.
// 2. Inside a JSX attribute only the attributes in TECH_ATTRS may hold a literal, and there rule 1 applies
//    to each value (to each space-separated token of className and rel); any other attribute, including
//    props of our own components, fails on any letter. A regex literal (shown via .source or String())
//    is read by rule 3 and fails when its pattern reads like prose.
// 3. Every literal, technical or not, is also read whole: static concatenation and joins of literal arrays
//    included. It fails on a term from forbidden-terms.mjs or a character that hides or disguises text
//    (controls other than tab and line breaks, format, private-use, unassigned, combining marks after NFC,
//    letter-like symbols and numbers (So, Sk, Nl, No), separators other than space and no-break spaces,
//    fillers, letters outside Latin-1 and Latin Extended-A/B).
//
// A bare word passes rule 1 only from WORDS, so new code words are added there under review.
// Messages never repeat the literal.
import { hasForbiddenTerm } from "./forbidden-terms.mjs";

// Change only with review (Risk: critical): every entry is text that can reach code but never the page.
const TECHNICAL = new Set(["GET", "POST", "Cache-Control", "Europe/Zagreb", "=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict"]);
const TECH_ATTRS =
  /^(className|key|href|lang|type|id|htmlFor|name|method|rel|target|role|scope|autoComplete|inputMode|src|dir|data-[\w-]+|aria-(hidden|live|current|invalid|describedby|labelledby|controls|expanded|busy|atomic|haspopup|pressed|selected|required|disabled|modal))$/;

const HIDDEN = /(?![\t\n\r])\p{Cc}|[\p{Cf}\p{Co}\p{Cn}\p{M}\u2800\u3164\uffa0\u115f\u1160]|(?![\x00-\x7f])[\p{So}\p{Sk}\p{Nl}\p{No}]|[^\P{Z} \u00a0\u202f]|(?![a-zA-Z\u00c0-\u024f])\p{L}/u;
// Change only with review (Risk: critical): bare words (letters and hyphens only) that code may hold,
// as codes, keys, classes and HTML values. Any other bare word fails, so a word can never pass by shape.
const WORDS = new Set([
  // HTML and HTTP values, JS type names
  "alert", "button", "col", "row", "region", "submit", "number", "numeric", "off", "password", "username",
  "current-password", "light", "sheet", "hr", "hr-HR", "post", "manual", "same-origin", "no-store", "force-dynamic",
  "content-length", "content-type", "cookie", "set-cookie", "retry-after", "sec-fetch-site", "string", "object",
  "true", "false", "ok", "status", "issuer", "student", "teacher", "noopener", "noreferrer",
  // field keys and element ids
  "aaiDomena", "aaiDomena-pomoc", "fakultetId", "korisnickoIme", "lozinka", "prijava", "prijava-greska",
  "nova-institucija", "nova-institucija-naslov", "-greska",
  // state and error codes mapped to the catalogue
  "aktivna", "greska", "nedostupan", "neispravno", "nema", "nepoznato", "obavezno", "odbijeno", "odjavljen", "opce",
  "prijavljen", "zabranjeno", "zatrazena", "zauzeto",
]);
const isTechnical = (t) => {
  if (!/\p{L}/u.test(t) || TECHNICAL.has(t)) return true;
  if (!/^[\x21-\x7e]+$/.test(t) || !/^[^A-Za-z]*[a-z]/.test(t)) return false;
  return !/^[A-Za-z-]+$/.test(t) || WORDS.has(t);
};

// The value of an expression built only from literals, or undefined.
const staticText = (node) => {
  if (!node) return undefined;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" || (node.type === "BinaryExpression" && node.operator === "+")) {
    const parts = segments(node);
    return parts.length === 1 && parts[0] !== undefined ? parts[0] : undefined;
  }
  return undefined;
};

// The parts of a template or a + chain in order: static text, or undefined for a dynamic operand.
const operands = (node) => {
  if (node.type === "BinaryExpression" && node.operator === "+") return [...operands(node.left), ...operands(node.right)];
  if (node.type === "TemplateLiteral") {
    return node.quasis.flatMap((q, i) =>
      i < node.expressions.length ? [q.value.cooked ?? q.value.raw, staticText(node.expressions[i])] : [q.value.cooked ?? q.value.raw]);
  }
  return [staticText(node)];
};
// Static runs between dynamic operands, each joined: `sum${"n"}jivo` is one run, `a${x}b` two.
// A chain with no static text at all gives [undefined].
const segments = (node) => {
  const out = [];
  let run;
  for (const p of operands(node)) {
    if (p === undefined) {
      if (run !== undefined) out.push(run);
      run = undefined;
      if (out.length === 0 || out.at(-1) !== undefined) out.push(undefined);
    } else run = (run ?? "") + p;
  }
  if (run !== undefined) out.push(run);
  return out;
};

// The JSX attribute a literal belongs to, looking up through expressions only (not into a nested element,
// a function or a statement), or null.
const STOP = /^(JSXElement|JSXFragment|Program|.*Function.*|.*Statement|.*Declaration|VariableDeclarator)$/;
const attributeOf = (node) => {
  for (let p = node.parent; p && !STOP.test(p.type); p = p.parent) {
    if (p.type === "JSXAttribute") return typeof p.name.name === "string" ? p.name.name : `${p.name.namespace.name}:${p.name.name.name}`;
  }
  return null;
};

const isExempt = (node) => {
  const p = node.parent;
  if (!p) return false;
  if (/^(ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration|ImportExpression)$/.test(p.type) && p.source === node) return true;
  return p.type === "ExpressionStatement" && typeof p.directive === "string";
};

const literalText = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      text: "Text in code is checked like the catalogue (scripts/checks/forbidden-terms.mjs).",
      literal: "UI text must come from src/i18n; other text with letters must be a technical token (scripts/checks/ui-text-lint.mjs).",
    },
  },
  create(context) {
    const read = (node, text) => {
      if (typeof text !== "string" || text === "") return;
      if (HIDDEN.test(text.normalize("NFC")) || hasForbiddenTerm(text)) context.report({ node, messageId: "text" });
    };
    const shape = (node, pieces) => {
      if (isExempt(node)) return;
      const attr = attributeOf(node);
      if (attr !== null && !TECH_ATTRS.test(attr)) {
        if (pieces.some((t) => /\p{L}/u.test(t))) context.report({ node, messageId: "literal" });
        return;
      }
      // className and rel hold space-separated tokens; every other value is one token.
      const tokens = attr === "className" || attr === "rel" ? pieces.flatMap((t) => t.split(/[ \t\n\r]+/).filter(Boolean)) : pieces;
      if (!tokens.every(isTechnical)) context.report({ node, messageId: "literal" });
    };
    // A template or an outermost + chain: each static run, and all runs joined (an empty dynamic operand
    // between them can split a term).
    const whole = (node) => {
      const runs = segments(node).filter((t) => t !== undefined);
      if (runs.length === 0) return;
      for (const t of runs) read(node, t);
      read(node, runs.join(""));
      shape(node, runs);
    };
    return {
      Literal(node) {
        if (node.regex) {
          // A pattern can be shown through .source or String(): read it like text, and fail when it reads
          // like prose (two words, or a capitalised word).
          read(node, node.regex.pattern);
          if (!isExempt(node) && /\p{L}{2,}[  ]+\p{L}{2,}|\p{Lu}\p{Ll}{2,}/u.test(node.regex.pattern))
            context.report({ node, messageId: "literal" });
          return;
        }
        if (typeof node.value !== "string") return;
        read(node, node.value);
        shape(node, [node.value]);
      },
      JSXText(node) {
        read(node, node.value);
        if (/\p{L}/u.test(node.value)) context.report({ node, messageId: "literal" });
      },
      TemplateLiteral: (node) => whole(node),
      BinaryExpression(node) {
        if (node.operator !== "+" || (node.parent?.type === "BinaryExpression" && node.parent.operator === "+")) return;
        whole(node);
      },
      "CallExpression[callee.property.name='join']"(node) {
        const arr = node.callee.object;
        if (arr?.type !== "ArrayExpression") return;
        const sep = node.arguments.length === 0 ? "," : staticText(node.arguments[0]);
        if (sep === undefined) return;
        // Holes join as "", spreads of literal arrays are expanded; anything else splits the runs.
        const items = (elements) =>
          elements.flatMap((e) =>
            e === null ? [""] : e.type === "SpreadElement" ? (e.argument.type === "ArrayExpression" ? items(e.argument.elements) : [undefined]) : [staticText(e)]);
        const runs = [];
        let run;
        for (const p of items(arr.elements)) {
          if (p === undefined) {
            if (run !== undefined) runs.push(run.join(sep));
            run = undefined;
          } else (run ??= []).push(p);
        }
        if (run !== undefined) runs.push(run.join(sep));
        if (runs.length === 0) return;
        for (const t of runs) read(node, t);
        read(node, runs.join(sep));
        shape(node, runs);
      },
    };
  },
};

export const uiTextPlugin = { rules: { "literal-text": literalText } };
