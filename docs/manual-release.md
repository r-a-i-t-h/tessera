# Manual release and offline deploy

The usual path is: tag push → GitHub Actions runs `npm run pack` → assets attach to a GitHub Release → [node-vps-kit](https://github.com/r-a-i-t-h/node-vps-kit) downloads `tessera.tar.gz` on install or update.

When GitHub is unavailable, you need a **new** version that never reached Releases, or you want to **roll back** without relying on the API, the tarball you build locally is the same artefact CI would ship. You can copy it to a VPS and point node-vps-kit at it, or seed its release download cache.

This document covers Tessera’s pack output and the kit commands that consume it. Kit layout and flags are defined in the node-vps-kit README; profile values for Tessera live in that repo’s `apps/tessera.psd1`.

## Same tarball as CI

`.github/workflows/release.yml` runs:

```bash
npm run pack
```

with `VERSION` set to the git tag. Locally, `npm run pack` invokes the same script (`scripts/pack-release.sh`). Outputs:

| File | Role |
|------|------|
| `dist-release/tessera.tar.gz` | Asset name node-vps-kit expects (`Tarball = 'tessera.tar.gz'`) |
| `dist-release/tessera-vX.Y.Z.tar.gz` | Same bytes, versioned filename for your own archive |

The archive top-level directory is `tessera/` (`ArchiveRoot` in the kit profile). It contains `dist/server.js`, `spa/`, `runtime/`, `skin/`, `seed/`, `deploy/`, production `node_modules/`, and a `VERSION` file with the tag (for example `v1.2.3`).

**`npm run release`** bumps `package.json`, commits, tags, and pushes. It does **not** pack. For a manual deploy, pack explicitly after checking out the commit or tag you want.

### Build on a dev machine

```bash
git fetch --tags
git checkout vX.Y.Z          # or the commit you intend to ship
npm run pack
ls -lh dist-release/tessera.tar.gz dist-release/tessera-vX.Y.Z.tar.gz
```

Pack runs `npm ci`, builds the workspaces, bundles the API with esbuild, installs production dependencies inside the staged tree, and adds Linux `sharp` binaries for **x64** and **arm64**. A pack on macOS is still suitable for typical VPS targets. CI builds on `ubuntu-latest` (linux x64); the resulting tree is intended to be equivalent for deployment.

To pin the tag written into `VERSION` without relying on `package.json`:

```bash
VERSION=vX.Y.Z npm run pack
```

## What an update changes on the server

node-vps-kit keeps instance **data** outside the release tree:

```text
/opt/tessera/<name>/
  current -> releases/vX.Y.Z/
  releases/          # unpacked trees (current + previous kept)
  data/              # TESSERA_DATA — not replaced on update
  backup/            # pre-update zip of data/
  env
```

`nvk-app-update` backs up `data/`, unpacks the new release under `releases/<tag>/`, repoints `current`, runs `deploy/post-update.sh` if present, and restarts systemd. Site content and editors in `data/` stay unless the hook migrates them.

## Release download cache (node-vps-kit)

Successful GitHub downloads are cached shared per app (not per instance):

```text
/var/cache/node-vps-kit/tessera/<tag>/
  tessera.tar.gz
  fetched              # UTC timestamp; drives “latest offline” ordering
```

The kit retains the **last three tags** per app. Fetching a fourth evicts the oldest cached tag. If GitHub is down and you request a tag that is still cached, update proceeds without a download. With `-Version latest` and GitHub unreachable, the kit uses the most recently fetched cached tag and logs a warning.

## Deploy without GitHub

Pick one of the following. Replace `www` with your instance name.

### Option A — point at a tarball (simplest)

Copy the file to the server, then:

```bash
sudo nvk-app-update -App tessera -Name www -Version vX.Y.Z \
  -Archive /path/to/tessera.tar.gz
```

`-Archive` skips GitHub and does not require a pre-seeded cache. Use this for first install during an outage as well:

```bash
sudo nvk-app-install -App tessera -Name www -ServerName editor.example.com -Port 7356 \
  -Version vX.Y.Z -Archive /path/to/tessera.tar.gz
```

The `-Version` value should match the release you intend; after unpack, the kit may normalize the tag from the `VERSION` file inside the archive.

**Reinstall the same version** (config refresh, or “already on vX.Y.Z — nothing to do” without `-Archive`):

```bash
sudo nvk-app-update -App tessera -Name www -Version vX.Y.Z \
  -Archive /path/to/tessera.tar.gz
```

### Option B — seed the shared cache, then update by tag

Useful if you want later updates of the same tag to work offline without passing `-Archive` each time.

On the VPS:

```bash
TAG=vX.Y.Z
sudo mkdir -p "/var/cache/node-vps-kit/tessera/$TAG"
sudo cp /path/to/tessera.tar.gz "/var/cache/node-vps-kit/tessera/$TAG/tessera.tar.gz"
printf '%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" | \
  sudo tee "/var/cache/node-vps-kit/tessera/$TAG/fetched" >/dev/null

sudo nvk-app-update -App tessera -Name www -Version "$TAG"
```

The cache directory name must be the tag (with a `v` prefix, e.g. `v1.2.3`), matching `-Version`.

Copy from your build machine:

```bash
scp dist-release/tessera.tar.gz you@vps:/tmp/tessera.tar.gz
```

### Option C — ship a version that never reached GitHub

1. Build and test locally at the intended commit (or bump version locally without pushing if you accept drift from the remote).
2. `npm run pack` (optionally `VERSION=vX.Y.Z npm run pack`).
3. Deploy with **Option A** or **B**.

You do not need a GitHub Release object as long as the kit receives a valid tarball and a consistent `-Version` / `VERSION` file.

## Roll back to an older release

| Situation | Action |
|-----------|--------|
| Older tag still in the last-three cache | `sudo nvk-app-update -App tessera -Name www -Version vOlder` |
| Older tag evicted from cache | Keep `dist-release/tessera-vOlder.tar.gz` in your own archive; deploy with `-Archive` or re-seed the cache |
| Previous tree still on disk | Under `/opt/tessera/<name>/releases/` the updater often keeps the prior unpacked directory until the next successful update; the supported rollback is still `nvk-app-update` to the older tag, not hand-editing `current` |

Rolling back replaces application code and libraries only; `data/` is unchanged. Run through the editor smoke checks you care about after a downgrade (authoring schema migrations run on API boot and generally move forward only).

## Quick reference

| Goal | Command |
|------|---------|
| Build release tarball locally | `npm run pack` → `dist-release/tessera.tar.gz` |
| Update from local file, no GitHub | `nvk-app-update … -Version vX.Y.Z -Archive /path/to/tessera.tar.gz` |
| Pre-load cache for tag | Copy into `/var/cache/node-vps-kit/tessera/vX.Y.Z/tessera.tar.gz` and touch `fetched` |
| Update from cache only | `nvk-app-update … -Version vX.Y.Z` |
| Typical release (GitHub up) | `npm run release -- --patch` (or `--minor` / `--major`) |

## See also

- [README § Release](../README.md#release) — default tag workflow
- [ARCHITECTURE.md](../ARCHITECTURE.md) — release tree layout and `TESSERA_DATA`
- [node-vps-kit README](https://github.com/r-a-i-t-h/node-vps-kit/blob/main/README.md) — install, update, cache, and disk layout
