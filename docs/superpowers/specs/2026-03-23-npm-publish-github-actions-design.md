# GitHub Actions: Publish to npm via Trusted Publishers

**Date:** 2026-03-23
**Package:** `aur-openlayers`
**Repo:** `NikolayNN/aur-openlayers`

## Goal

Automatically publish the Angular library to npm when the version in `projects/lib/package.json` changes on push to `master`. Uses npm Trusted Publishers (OIDC) — no npm token secrets needed.

## Requirements

- Trigger: push to `master` branch
- Only publish when version in `projects/lib/package.json` actually changed
- Run tests before publishing
- Use npm Trusted Publishers (OIDC-based authentication)
- Keep existing `publish.bat` for local use

## Workflow: `.github/workflows/publish-npm.yml`

### Trigger

```yaml
on:
  push:
    branches: [master]
```

### Permissions

```yaml
permissions:
  contents: read
  id-token: write   # required for npm OIDC Trusted Publishers
```

### Job 1: `check-version`

Compares version between current and previous commit.

- `actions/checkout@v4` with `fetch-depth: 2`
- Extract old version from `HEAD~1:projects/lib/package.json`
- Extract new version from `projects/lib/package.json`
- Set output `changed=true` if versions differ

```bash
OLD=$(git show HEAD~1:projects/lib/package.json | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).version")
NEW=$(node -p "require('./projects/lib/package.json').version")
echo "changed=$( [ \"$OLD\" != \"$NEW\" ] && echo true || echo false )" >> $GITHUB_OUTPUT
```

Output: `changed` (true/false)

### Job 2: `test`

Condition: `needs.check-version.outputs.changed == 'true'`

Steps:
1. `actions/checkout@v4`
2. `actions/setup-node@v4` with `node-version: 20`, `cache: npm`
3. `npm ci`
4. `npx ng test lib --watch=false --browsers=ChromeHeadless`

### Job 3: `publish`

Condition: `needs: [check-version, test]`
Environment: `npm` (linked to npm Trusted Publisher config)

Steps:
1. `actions/checkout@v4`
2. `actions/setup-node@v4` with `node-version: 20`, `registry-url: 'https://registry.npmjs.org'`
3. `npm ci`
4. `npx ng build lib`
5. `npm publish dist/lib --provenance --access public`

## Manual Setup Required (npmjs.com)

Before the workflow will work, configure Trusted Publishers on npmjs.com:

1. Go to https://www.npmjs.com/package/aur-openlayers/access
2. Under "Publishing access" → "Trusted Publishers" → "Add new"
3. Configure:
   - **Repository owner:** `NikolayNN`
   - **Repository name:** `aur-openlayers`
   - **Workflow filename:** `publish-npm.yml`
   - **Environment:** `npm`

## Manual Setup Required (GitHub)

Create a GitHub environment named `npm`:

1. Go to repo Settings → Environments → New environment
2. Name: `npm`
3. No additional protection rules needed (optional: add reviewers for manual approval)

## Files Changed

- **New:** `.github/workflows/publish-npm.yml`

## Files NOT Changed

- `publish.bat` — kept as-is for local publishing
- `.npmrc` — stays in `.gitignore`, not affected
