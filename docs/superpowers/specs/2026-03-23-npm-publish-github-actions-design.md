# GitHub Actions: Publish to npm via Trusted Publishers

**Date:** 2026-03-23
**Package:** `aur-openlayers`
**Repo:** `NikolayNN/aur-openlayers`

## Goal

Automatically publish the Angular library to npm when the version in `projects/lib/package.json` changes on push to `master`. Uses npm Trusted Publishers (OIDC) — no npm token secrets needed.

## Requirements

- Trigger: push to `master` branch (+ `workflow_dispatch` for manual recovery)
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
  workflow_dispatch:
```

`workflow_dispatch` allows manual re-trigger if a publish fails (network issue, npm outage, etc.).

### Permissions

```yaml
permissions:
  contents: read
  id-token: write   # required for npm OIDC Trusted Publishers
```

### Concurrency

```yaml
concurrency:
  group: npm-publish
  cancel-in-progress: false   # don't cancel in-progress publishes
```

### Job 1: `check-version`

Compares the version in `projects/lib/package.json` against the npm registry.

- `runs-on: ubuntu-latest`
- `actions/checkout@v4`
- Compare local version with published version on npm
- Set output `changed=true` if local version is newer / different

```bash
PUBLISHED=$(npm view aur-openlayers version 2>/dev/null || echo "0.0.0")
LOCAL=$(jq -r .version projects/lib/package.json)
echo "published=$PUBLISHED"
echo "local=$LOCAL"
echo "changed=$( [ "$PUBLISHED" != "$LOCAL" ] && echo true || echo false )" >> $GITHUB_OUTPUT
```

Comparing against the npm registry (instead of git history) is more robust:
- Works correctly on merge commits and first commits
- Works with `workflow_dispatch` (no `github.event.before`)
- Correctly retries failed publishes (version in npm still old)

Output: `changed` (true/false)

### Job 2: `test`

- `runs-on: ubuntu-latest`
- Condition: `needs.check-version.outputs.changed == 'true'`
- `needs: check-version`

Steps:
1. `actions/checkout@v4`
2. `actions/setup-node@v4` with `node-version: 20`, `cache: npm`
3. `npm ci`
4. `npx ng test lib --watch=false --browsers=ChromeHeadless`

### Job 3: `publish`

- `runs-on: ubuntu-latest`
- `needs: [check-version, test]`
- Condition: `needs.check-version.outputs.changed == 'true'`
- Environment: `npm` (linked to npm Trusted Publisher config)

Steps:
1. `actions/checkout@v4`
2. `actions/setup-node@v4` with `node-version: 20`, `registry-url: 'https://registry.npmjs.org'`
3. `npm ci`
4. `npx ng build lib`
5. `npm publish dist/lib --provenance --access public`

## Edge Cases

### Failed publish
If `npm publish` fails (network, npm outage), the version on npm remains old. On the next push to master, `check-version` compares against npm and sees the version is still different → triggers a new publish attempt. Can also be manually re-triggered via `workflow_dispatch`.

### Version already exists on npm
If someone publishes the same version locally via `publish.bat`, the CI publish will fail with "version already exists". This is expected — bump the version for the next release.

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

## Post-Setup Cleanup

After confirming that Trusted Publishers works:

- Revoke the legacy npm auth token at https://www.npmjs.com/settings/~/tokens

## Files Changed

- **New:** `.github/workflows/publish-npm.yml`

## Files NOT Changed

- `publish.bat` — kept as-is for local publishing
- `.npmrc` — stays in `.gitignore`, not affected
