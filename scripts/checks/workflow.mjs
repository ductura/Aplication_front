// CI supply chain: remote `uses` pinned to a full commit SHA with a `# vX` comment,
// only read/none permissions, no secrets, no privileged triggers.
import { parse } from "yaml";

const PINNED = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/;
const DOCKER = /^docker:\/\/[^@\s]+@sha256:[0-9a-f]{64}$/;

const permissionErrors = (perms, where) => {
  if (perms === undefined) return where === "top" ? ["top-level permissions missing"] : [];
  if (!perms || typeof perms !== "object") return [`${where}: permissions must be a map`];
  return Object.entries(perms).filter(([, v]) => v !== "read" && v !== "none").map(([k, v]) => `${where}: ${k}: ${v}`);
};

const usesErrors = (node, lines) => {
  if (!node || typeof node !== "object") return [];
  const ref = typeof node.uses === "string" ? node.uses.trim() : "./";
  const own =
    ref.startsWith("./") || DOCKER.test(ref) ? []
    : !PINNED.test(ref) ? [`unpinned uses: ${ref}`]
    : lines.some((l) => l.includes(ref) && /#\s*v\d/.test(l)) ? []
    : [`missing version comment: ${ref}`];
  return own.concat(Object.values(node).flatMap((v) => usesErrors(v, lines)));
};

export function checkWorkflow(text) {
  const doc = parse(text) ?? {};
  const lines = text.split("\n").filter((l) => !/^\s*#/.test(l));
  const on = doc.on ?? {};
  const triggers = typeof on === "string" ? [on] : Array.isArray(on) ? on : Object.keys(on);
  return [
    ...permissionErrors(doc.permissions, "top"),
    ...Object.entries(doc.jobs ?? {}).flatMap(([id, job]) => permissionErrors(job?.permissions, id)),
    ...usesErrors(doc.jobs ?? {}, lines),
    ...triggers.filter((t) => ["pull_request_target", "workflow_run"].includes(t)).map((t) => `banned trigger: ${t}`),
    ...(lines.some((l) => /\bsecrets\b/.test(l)) ? ["secrets are not allowed"] : []),
  ];
}
