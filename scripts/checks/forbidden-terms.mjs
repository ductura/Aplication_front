// Forbidden UI terms from Ductus docs/PRODUCT.md §5 (Rječnik) and D-276,
// Ductus commit 078c780f. Text and patterns are folded: lower case, no
// diacritics, đ/dj -> d, invisible characters removed, spaces and hyphens -> " ".
// "W" = rest of the word. Conditional rows are applied strictly (see contract).
const W = "\\p{L}*";
const DATA = `poda[tc]${W}`;
const TERMS = [
  `sumnj${W}`, `rizi[kc]${W}`, `anomalij${W}`, `upozorenj${W} o student${W}`,
  `ai postot${W}`, `postot${W} (ai|ljudsk)${W}`, `udi${W} ai`, `ljudsk${W} udi${W}`, `ljudskost${W}`,
  `\\d+ ?% ?ai`, `ai \\d+ ?%`, `vjerojatn${W}`, `autenticn${W}`, `autenticitet${W}`,
  `napisa${W} ai`, `ai (je )?napisa${W}`, `verificiran${W} autorstv${W}`, `dokaz${W} autorstv${W}`,
  `kopir${W}`, `prepis${W}`, `tud${W} (tekst|rijec)${W}`, `nije (vlastit|njegov|njezin)${W}`,
  `(nestal|nedostajuc|izgubljen)${W} ${DATA}`, `${DATA} (su )?(nestal|nedostaj|izgubljen)${W}`,
  `(s|sa|pri)kriven${W}`, `plagij${W}`, `plagir${W}`, `izvornost${W}`, `originalnost${W}`,
  `neoriginaln${W}`, `integritet${W}`, `neobicn${W}`, `neuobicajen${W}`, `nepraviln${W}`,
  `ljudski napisan${W}`, `napisa${W} covjek${W}`, `spremljen${W}(?! na (uredaj|posluzitelj))`,
  `suspic${W}`, `suspect${W}`, `doubt${W}`, `risk${W}`, `anomal${W}`, `warning about the student`,
  `ai (percentage|share)`, `human share`, `humanness`, `probab${W}`, `likelihood`, `authenticity`,
  `written by (ai|a human)`, `(verified|proof of) authorship`, `copied`, `copying`, `copy paste`,
  `someone else'?s text`, `not their own`, `(vanished|missing|lost) data`, `hidden`, `concealed`,
  `plagiar${W}`, `(un)?originality`, `unoriginal`, `integrity`, `unusual`, `atypical`, `irregular${W}`,
  `human written`, `(trust|attention) score`, `cheat${W}`, `dishonest${W}`, `misconduct`,
  `ai detected`, `flagged${W}`, `saved(?! (on|to) (the )?(device|server))`,
];
const ALLOWED = [
  "kopiraj navod", "kopiranje navoda", "kopirano u meduspremnik", "copy citation",
  "nepravilan format", "nije dokaz autorstva", "spremljen\\p{L}* na (uredaju|posluzitelju)",
];

export const fold = (text) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ­​-‍⁠﻿]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/dj/g, "d")
    .replace(/[’`]/g, "'")
    .replace(/[\s\-‐-―]+/gu, " ");

const bounded = (src) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${src})(?![\\p{L}\\p{N}])`, "gu");
const termRes = TERMS.map(bounded);
const allowRes = ALLOWED.map(bounded);

const scan = (text) => {
  let folded = fold(text);
  for (const re of allowRes) folded = folded.replace(re, (m) => " ".repeat(m.length));
  return termRes.find((re) => ((re.lastIndex = 0), re.test(folded)));
};

export function findForbidden(value, key = "") {
  if (typeof value === "string") {
    const re = scan(value);
    return re ? [{ key, term: re.source }] : [];
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => findForbidden(v, key ? `${key}.${k}` : k));
  }
  return [{ key, term: "not text" }];
}
