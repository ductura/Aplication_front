// CI supply chain: remote `uses` pinned to a full commit SHA with a `# vX` comment, container
// images pinned by digest, only read/none permissions, no secrets or token, no privileged triggers.
import { parse } from "yaml";

const PINNED = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/;
const DIGEST = /^(docker:\/\/)?[^@\s]+@sha256:[0-9a-f]{64}$/;

const permissionErrors = (perms, where) => {
  if (perms === undefined) return where === "top" ? ["top-level permissions missing"] : [];
  if (!perms || typeof perms !== "object") return [`${where}: permissions must be a map`];
  return Object.entries(perms).filter(([, v]) => v !== "read" && v !== "none").map(([k, v]) => `${where}: ${k}: ${v}`);
};

// Walks every node: `uses` (steps and reusable jobs), `image` and string `container`.
const refErrors = (node, lines, key = "") => {
  if (key === "uses" || (["image", "container"].includes(key) && typeof node !== "object")) {
    const ref = String(node).trim();
    if (key !== "uses" || ref.startsWith("docker://")) return DIGEST.test(ref) ? [] : [`unpinned ${key}: ${ref}`];
    if (!PINNED.test(ref)) return [`unpinned uses: ${ref}`];
    return lines.some((l) => l.includes(ref) && /#\s*v\d/.test(l)) ? [] : [`missing version comment: ${ref}`];
  }
  if (!node || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([k, v]) => refErrors(v, lines, Array.isArray(node) ? "" : k));
};

export function checkWorkflow(text) {
  if (/^\s*%YAML/m.test(text)) return ["YAML directives are not allowed"];
  const doc = parse(text) ?? {};
  const lines = text.split("\n").filter((l) => !/^\s*#/.test(l));
  const on = doc.on ?? [];
  const triggers = typeof on === "string" ? [on] : Array.isArray(on) ? on : Object.keys(on);
  return [
    ...(triggers.length ? [] : ["triggers missing"]),
    ...permissionErrors(doc.permissions, "top"),
    ...Object.entries(doc.jobs ?? {}).flatMap(([id, job]) => permissionErrors(job?.permissions, id)),
    ...refErrors(doc.jobs ?? {}, lines),
    ...triggers.filter((t) => ["pull_request_target", "workflow_run"].includes(t)).map((t) => `banned trigger: ${t}`),
    ...(lines.some((l) => /\bsecrets\b|\bgithub\s*\.\s*token\b/i.test(l)) ? ["secrets and token are not allowed"] : []),
  ];
}
