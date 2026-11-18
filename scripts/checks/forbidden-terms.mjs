// Forbidden UI terms from Ductus docs/PRODUCT.md §5 (Rječnik) and D-276, Ductus commit 078c780f.
// Text and patterns are folded: lower case, no diacritics, đ/dj -> d, format characters removed,
// punctuation and symbols (except % and ') -> " ". W = rest of the word; "~" = any prefix.
// Letters outside Latin-1 and Latin Extended-A/B are reported (homoglyphs).
// Conditional rows are applied strictly (contract c.6992282372).
const W = "\\p{L}*";
const DATA = `poda[tc]${W}`;
const NUM = "\\d+ ?(%|posto)";
const SUBJ = `(ai( ja)?|ljudsk${W}|podrijetl${W}|izvor${W})`;
const GAP = "( \\p{L}+){0,3}";
const TERMS = [
  `~sumnj${W}`, `~rizi[kc]${W}`, `~anomalij${W}`, `upozorenj${W} (o|za|na) student${W}`, `~vjerojat${W}`,
  `~autentic${W}`, `~kopir${W}`, `~prepis${W}`, `~plagi(j|r|at)${W}`, `~izvornost${W}`, `neizvorn${W}`, `~originalnost${W}`, `neoriginal${W}`, `~integritet${W}`, `neobic${W}`, `neuobicaj${W}`,
  `nepravil${W}`, `(s|sa|pri)kriv${W}`, `ljudskost${W}`, `ljudski napisan${W}`, `napisa${W} covjek${W}`,
  `ai postot${W}`, `postot${W} (ai|ljudsk)${W}`, `ud(i|e)${W} ai`, `ai( ja)? ud(i|e)${W}`, `ljudsk${W} ud(i|e)${W}`,
  `${NUM}${GAP} ${SUBJ}`, `${SUBJ}${GAP} ?${NUM}`, `napisa${W} ai`, `ai (je )?napisa${W}`, `verificiran${W} autorstv${W}`,
  `dokaz${W} autorstv${W}`, `tud${W} (tekst|rijec)${W}`, `nije (vlastit|njegov|njezin)${W}`,
  `(nestal|nedostaj|izgubljen)${W}( \\p{L}+)? ${DATA}`, `${DATA}( \\p{L}+)? (nestal|nedostaj|izgubljen)${W}`,
  `spremljen${W}(?!( \\p{L}+){0,2} na (uredaj|posluzitelj))`,
  `~suspic${W}`, `suspect${W}`, `doubt${W}`, `risk${W}`, `anomal${W}`, `warning about the student`,
  `ai (percentage|share)`, `human share`, `humanness`, `probab${W}`, `likelihood`, `authenticity`,
  `written by (ai|a human)`, `(verified|proof of) authorship`, `copied`, `copying`, `copy paste${W}`,
  `someone else'?s text`, `not their own`, `(vanished|missing|lost) data`, `hidden`, `concealed`,
  `plagiar${W}`, `(un)?originality`, `unoriginal`, `integrity`, `unusual`, `atypical`, `irregular${W}`,
  `human written`, `(trust|attention) score`, `cheat${W}`, `dishonest${W}`, `misconduct`,
  `ai detected`, `flagged${W}`, `saved(?! (on|to) (the )?(device|server))`,
];
const ALLOWED = [
  "kopiraj navod", "kopiranje navoda", "kopirano u meduspremnik", "copy citation",
  "nepravilan format", "nije dokaz autorstva", `spremljen${W}( \\p{L}+){0,2} na (uredaju|posluzitelju)`,
];

export const fold = (text) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]|\p{Cf}/gu, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/dj/g, "d")
    .replace(/[’`]/g, "'")
    .replace(/[^\p{L}\p{N}%']+/gu, " ");

const bounded = (src) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${src.startsWith("~") ? `${W}${src.slice(1)}` : src})(?![\\p{L}\\p{N}])`, "gu");
const termRes = TERMS.map(bounded);
const allowRes = ALLOWED.map(bounded);

const scan = (text) => {
  if (/(?![a-z\u00c0-\u024f])\p{L}/iu.test(text)) return /letter outside Latin-1 and Latin Extended/;
  let folded = fold(text);
  for (const re of allowRes) folded = folded.replace(re, (m) => " ".repeat(m.length));
  return termRes.find((re) => ((re.lastIndex = 0), re.test(folded)));
};

const isPlain = (v) => Array.isArray(v) || [Object.prototype, null].includes(Object.getPrototypeOf(v));

export function findForbidden(value, key = "") {
  if (typeof value === "string") {
    const re = scan(value);
    return re ? [{ key, term: re.source }] : [];
  }
  if (value && typeof value === "object" && isPlain(value)) {
    return Object.entries(value).flatMap(([k, v]) => findForbidden(v, key ? `${key}.${k}` : k));
  }
  return [{ key, term: "not text" }];
}
