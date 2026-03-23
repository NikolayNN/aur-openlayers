# npm Publish GitHub Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically publish `aur-openlayers` to npm on version change via GitHub Actions with Trusted Publishers (OIDC).

**Architecture:** Single workflow file with three jobs: check-version (compare local vs npm registry), test (ng test), publish (ng build + npm publish --provenance). OIDC authentication via npm Trusted Publishers — no secrets needed.

**Tech Stack:** GitHub Actions, npm Trusted Publishers (OIDC), Angular CLI (ng-packagr), jq

**Spec:** `docs/superpowers/specs/2026-03-23-npm-publish-github-actions-design.md`

---

### Task 1: Create the publish workflow file

**Files:**
- Create: `.github/workflows/publish-npm.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: Publish to npm

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

concurrency:
  group: npm-publish
  cancel-in-progress: false

jobs:
  check-version:
    runs-on: ubuntu-latest
    outputs:
      changed: ${{ steps.compare.outputs.changed }}
    steps:
      - uses: actions/checkout@v4

      - name: Compare local version with npm registry
        id: compare
        run: |
          PUBLISHED=$(npm view aur-openlayers version 2>/dev/null || echo "0.0.0")
          LOCAL=$(jq -r .version projects/lib/package.json)
          echo "Published version: $PUBLISHED"
          echo "Local version: $LOCAL"
          echo "changed=$( [ "$PUBLISHED" != "$LOCAL" ] && echo true || echo false )" >> $GITHUB_OUTPUT

  test:
    runs-on: ubuntu-latest
    needs: check-version
    if: needs.check-version.outputs.changed == 'true'
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run library tests
        run: npx ng test lib --watch=false --browsers=ChromeHeadless

  publish:
    runs-on: ubuntu-latest
    needs: [check-version, test]
    if: needs.check-version.outputs.changed == 'true'
    environment: npm
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Build library
        run: npx ng build lib

      - name: Publish to npm
        run: npm publish dist/lib --provenance --access public
```

Write this exact content to `.github/workflows/publish-npm.yml`.

- [ ] **Step 2: Validate YAML syntax**

Run: `npx yaml-lint .github/workflows/publish-npm.yml 2>/dev/null || node -e "const yaml = require('yaml'); const fs = require('fs'); yaml.parse(fs.readFileSync('.github/workflows/publish-npm.yml','utf8')); console.log('YAML is valid')"`

If no yaml parser is available, manually verify the indentation is correct — all job properties at 4 spaces, steps at 6 spaces, step properties at 8 spaces.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/publish-npm.yml
git commit -m "ci: add npm publish workflow with Trusted Publishers (OIDC)"
```

### Task 2: Verify workflow against spec

- [ ] **Step 1: Cross-check workflow against spec**

Read both files and verify:
- `.github/workflows/publish-npm.yml`
- `docs/superpowers/specs/2026-03-23-npm-publish-github-actions-design.md`

Checklist:
- [ ] Trigger: `push: branches: [master]` + `workflow_dispatch`
- [ ] Permissions: `contents: read` + `id-token: write`
- [ ] Concurrency: `group: npm-publish`, `cancel-in-progress: false`
- [ ] `check-version` job: `outputs` declared, step has `id: compare`, compares via `npm view`, uses `jq`
- [ ] `test` job: `needs: check-version`, `if: changed == 'true'`, runs `ng test lib --watch=false --browsers=ChromeHeadless`
- [ ] `publish` job: `needs: [check-version, test]`, `if: changed == 'true'`, `environment: npm`, `registry-url` set, runs `ng build lib` then `npm publish dist/lib --provenance --access public`
- [ ] Workflow has `name: Publish to npm`

---

### Post-Implementation: Manual Setup (not automated)

These steps must be done manually by the repo owner after the workflow is pushed:

**npmjs.com:**
1. Go to https://www.npmjs.com/package/aur-openlayers/access
2. Publishing access → Trusted Publishers → Add new
3. Repository owner: `NikolayNN`, Repository name: `aur-openlayers`, Workflow: `publish-npm.yml`, Environment: `npm`

**GitHub:**
1. Repo Settings → Environments → New environment → Name: `npm`

**After first successful publish:**
- Revoke the legacy npm auth token at https://www.npmjs.com/settings/~/tokens
