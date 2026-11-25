import { spawnSync } from "node:child_process";
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

  const SHARED = /^ductura\/\.github\/\.github\/workflows\/(secret-scan|dependency-review)\.yml@[0-9a-f]{40}$/;
  const ciDoc = () => parse(readFileSync(".github/workflows/ci.yml", "utf8"));

  it("calls the shared secret scan and dependency review pinned to a SHA; the review runs only on pull requests", () => {
    const { jobs } = ciDoc();
    expect(jobs["secret-scan"].uses).toMatch(SHARED);
    expect(jobs["secret-scan"].uses).toContain("secret-scan.yml@");
    expect(jobs["dependency-review"].uses).toMatch(SHARED);
    expect(jobs["dependency-review"].uses).toContain("dependency-review.yml@");
    expect(jobs["dependency-review"].if).toBe("${{ github.event_name == 'pull_request' }}");
    expect(jobs["secret-scan"].if).toBeUndefined();
  });

  it("ci-ok needs every other job, always runs and passes only when all of them succeeded", () => {
    const ci = ciDoc();
    const ok = ci.jobs["ci-ok"];
    expect(ok.if).toBe("${{ always() }}");
    expect(ok.permissions).toEqual({});
    expect([ok.needs].flat().sort()).toEqual(Object.keys(ci.jobs).filter((j) => j !== "ci-ok").sort());
    expect(ok.steps).toHaveLength(1);
    expect(ok.steps[0].env.RESULTS).toBe("${{ toJSON(needs) }}");
    expect(ok.steps[0].env.ALLOW_SKIPPED).toBe("dependency-review");
    const needs = (r) => JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { result: v, outputs: {} }])));
    const run = (results, skipped = ok.steps[0].env.ALLOW_SKIPPED) => spawnSync("bash", ["-eo", "pipefail", "-c", ok.steps[0].run], { env: { ...process.env, RESULTS: results, ALLOW_SKIPPED: skipped } }).status;
    const all = { ci: "success", "secret-scan": "success", "dependency-review": "success" };
    expect(run(needs(all))).toBe(0);
    expect(run(needs({ ...all, "dependency-review": "skipped" }))).toBe(0);
    for (const job of Object.keys(all)) {
      for (const r of ["failure", "cancelled"]) expect(run(needs({ ...all, [job]: r })), `${job} ${r}`).not.toBe(0);
    }
    for (const job of ["ci", "secret-scan"]) expect(run(needs({ ...all, [job]: "skipped" })), `${job} skipped`).not.toBe(0);
    for (const bad of ["", "{}", "[]", "not json", JSON.stringify({ ci: {} })]) expect(run(bad), bad).not.toBe(0);
    expect(run(needs({ ...all, "dependency-review": "skipped" }), "")).not.toBe(0);
  });

  it("dependabot updates github-actions and npm weekly, grouped, with a cooldown", () => {
    const { version, updates } = parse(readFileSync(".github/dependabot.yml", "utf8"));
    expect(version).toBe(2);
    expect(updates.map((u) => u["package-ecosystem"]).sort()).toEqual(["github-actions", "npm"]);
    for (const u of updates) {
      expect(u.directory).toBe("/");
      expect(u.schedule.interval).toBe("weekly");
      expect(Object.keys(u.groups).length).toBeGreaterThan(0);
      expect(u.cooldown["default-days"]).toBeGreaterThan(0);
    }
  });
});
