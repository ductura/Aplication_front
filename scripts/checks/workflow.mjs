// CI supply-chain checks: every remote `uses` pinned to a full commit SHA with
// a version comment, only read/none permissions, no secrets, no privileged triggers.
import { parse } from "yaml";

const PINNED = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/;
const DOCKER = /^docker:\/\/[^@\s]+@sha256:[0-9a-f]{64}$/;
const BANNED_TRIGGERS = ["pull_request_target", "workflow_run"];

function permissionErrors(perms, where) {
  if (perms === undefined) return where === "top" ? ["top-level permissions missing"] : [];
  if (!perms || typeof perms !== "object") return [`${where}: permissions must be a map`];
  return Object.entries(perms)
    .filter(([, level]) => level !== "read" && level !== "none")
    .map(([scope, level]) => `${where}: ${scope}: ${level}`);
}

function usesErrors(node, lines) {
  if (Array.isArray(node)) return node.flatMap((n) => usesErrors(n, lines));
  if (!node || typeof node !== "object") return [];
  const own = [];
  if (typeof node.uses === "string") {
    const ref = node.uses.trim();
    if (ref.startsWith("./")) {
      // Local action from this repository: reviewed with the PR.
    } else if (!PINNED.test(ref) && !DOCKER.test(ref)) {
      own.push(`unpinned uses: ${ref}`);
    } else if (PINNED.test(ref) && !lines.some((l) => l.includes(ref) && /#\s*v\d/.test(l))) {
      own.push(`missing version comment: ${ref}`);
    }
  }
  return own.concat(Object.values(node).flatMap((v) => usesErrors(v, lines)));
}

export function checkWorkflow(text) {
  const doc = parse(text) ?? {};
  const lines = text.split("\n").filter((l) => !/^\s*#/.test(l));
  const on = doc.on ?? {};
  const triggers = typeof on === "string" ? [on] : Array.isArray(on) ? on : Object.keys(on);
  const errors = [
    ...permissionErrors(doc.permissions, "top"),
    ...Object.entries(doc.jobs ?? {}).flatMap(([id, job]) => permissionErrors(job?.permissions, id)),
    ...usesErrors(doc.jobs ?? {}, lines),
    ...triggers.filter((t) => BANNED_TRIGGERS.includes(t)).map((t) => `banned trigger: ${t}`),
  ];
  if (lines.some((l) => /\bsecrets\b/.test(l))) errors.push("secrets are not allowed");
  return errors;
}
