import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkWorkflow } from "../scripts/checks/workflow.mjs";

const sha = "3d3c42e5aac5ba805825da76410c181273ba90b1";
const ok = `on: [push, pull_request]
permissions:
  contents: read
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      # uses: actions/cache@main
      - uses: actions/checkout@${sha} # v7.0.1
      - uses: ./.github/actions/local
`;
const perm = (p) => ok.replace("permissions:\n  contents: read", p);
const env = (v) => `${ok}        env:\n          T: \${{ ${v} }}\n`;
const step = (u) => ok.replace(`actions/checkout@${sha} # v7.0.1`, u);

describe("workflow checker", () => {
  it.each([
    ["tag ref", step("actions/checkout@v7")], ["branch ref", step("actions/checkout@main")],
    ["short sha", step(`actions/checkout@${sha.slice(0, 7)} # v7`)], ["quoted tag", step('"actions/checkout@v7"')],
    ["missing version comment", step(`actions/checkout@${sha}`)], ["docker tag", step("docker://alpine:3")],
    ["reusable workflow tag", `${ok}  call:\n    uses: o/r/.github/workflows/x.yml@v1\n`],
    ["no top-level permissions", perm("")], ["write-all", perm("permissions: write-all")],
    ["read-all", perm("permissions: read-all")], ["write scope", perm("permissions:\n  contents: write")],
    ["flow map write", perm("permissions: { contents: write }")],
    ["job-level write", ok.replace("    runs-on", "    permissions:\n      id-token: write\n    runs-on")],
    ["pull_request_target", ok.replace("pull_request]", "pull_request_target]")],
    ["workflow_run", ok.replace("pull_request]", "workflow_run]")],
    ["secrets dot", env("secrets.TOKEN")], ["secrets index", env("secrets['TOKEN']")],
  ])("rejects %s", (_, text) => {
    expect(checkWorkflow(text)).not.toEqual([]);
  });

  it("accepts a pinned read-only workflow", () => {
    expect(checkWorkflow(ok)).toEqual([]);
    expect(checkWorkflow(step(`docker://alpine@sha256:${"a".repeat(64)}`))).toEqual([]);
  });

  it("every real workflow passes and CI runs install, lint, test and build", () => {
    const dir = ".github/workflows";
    const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
    expect(files).toContain("ci.yml");
    for (const f of files) expect(checkWorkflow(readFileSync(`${dir}/${f}`, "utf8")), f).toEqual([]);
    const ci = readFileSync(`${dir}/ci.yml`, "utf8");
    for (const cmd of ["pnpm install --frozen-lockfile", "pnpm lint", "pnpm test", "pnpm build"]) {
      expect(ci).toContain(`run: ${cmd}\n`);
    }
    expect(ci).toContain("persist-credentials: false");
  });
});
