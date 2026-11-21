import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
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
    ["secrets upper case", env("SECRETS.TOKEN")], ["github token", env("github.token")], ["github token index", env("github['token']")],
    ["local action", step("./.github/actions/x")], ["non-string uses", step("{ a: 1 }")],
    ["service image tag", `${ok}    services:\n      db:\n        image: postgres:latest\n`],
    ["container tag", ok.replace("    runs-on", "    container: node:26\n    runs-on")],
    ["map trigger", ok.replace("on: [push, pull_request]", "on:\n  pull_request_target:\n    types: [opened]")],
    ["no triggers", ok.replace("on: [push, pull_request]\n", "")], ["YAML 1.1", `%YAML 1.1\n---\n${ok}`],
  ])("rejects %s", (_, text) => {
    expect(checkWorkflow(text)).not.toEqual([]);
  });

  it("accepts a pinned read-only workflow", () => {
    expect(checkWorkflow(ok)).toEqual([]);
    expect(checkWorkflow(step(`docker://alpine@sha256:${"a".repeat(64)}`))).toEqual([]);
    expect(checkWorkflow(ok.replace("    runs-on", `    container: node@sha256:${"b".repeat(64)}\n    runs-on`))).toEqual([]);
  });

  it("every workflow passes and CI checks the phase two branch", () => {
    const dir = ".github/workflows";
    const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
    expect(files).toContain("ci.yml");
    for (const f of files) expect(checkWorkflow(readFileSync(`${dir}/${f}`, "utf8")), f).toEqual([]);
    const ci = parse(readFileSync(`${dir}/ci.yml`, "utf8"));
    const steps = ci.jobs.ci.steps;
    expect(steps.map((step) => step.run)).toEqual(expect.arrayContaining([
      "pnpm install --frozen-lockfile", "pnpm typecheck", "pnpm lint", "pnpm test", "pnpm build", "pnpm e2e",
    ]));
    expect(ci.on.push.branches).toEqual(expect.arrayContaining([expect.stringMatching(/^migracija\/(?:faza2|\*\*)$/)]));
    expect(steps.find((step) => step.uses?.startsWith("actions/checkout@"))?.with?.["persist-credentials"]).toBe(false);
  });
});
