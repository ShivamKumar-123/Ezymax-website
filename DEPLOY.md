# Deploying the Ezymex website

The site that gets deployed is **`apps/trader`**, the only app in this repo.
Set `NEXT_PUBLIC_CRM_URL` to the live Ezymex Client Area so Log in / Sign up
go there.

## Why this repo needs deployment config at all

Vercel deploys from a **Root Directory**, and by default that is the repository
root. It reads the `package.json` there to work out which framework to build and
where the app's dependencies live. This repo's root `package.json` is only a
monorepo orchestrator — the Next.js app lives one level down. Left alone, the
build fails at the very first step with:

```
Error: No Next.js version detected. Make sure your package.json has "next" in
either "dependencies" or "devDependencies". Also check your Root Directory
setting matches the directory of your package.json file.
```

## The setup that is committed here

`vercel.json` at the repo root, which works with the default Root Directory:

| Setting | Value | Why |
|---|---|---|
| `installCommand` | installs `apps/trader` first, then the root | The app install provides what the build compiles against. The root install puts `next` in the root `node_modules`, where Vercel's builder looks for it. |
| `buildCommand` | `npm --prefix apps/trader run build` | Builds the app in its own directory. |
| `outputDirectory` | `apps/trader/.next` | Points Vercel at the build output, which is not at the root. |

Plus `next` pinned in the root `package.json` `devDependencies`, purely so
framework detection succeeds. Keep that version in step with `apps/trader`.

**The install order matters and is not cosmetic.** Running the root install
first and `npm --prefix apps/trader install` second leaves the root
`node_modules` holding only stray native binaries, with no `next` to resolve.
Installing the app first, in a subshell so the working directory is restored,
and the root last, leaves `next` resolvable at both levels. Verified by wiping
both `node_modules` in a fresh clone and re-running.

`apps/trader/next.config.mjs` also skips `output: 'standalone'` when `VERCEL` is
set, because Vercel builds Next.js natively and does not consume a standalone
bundle, and derives the build id from `VERCEL_GIT_COMMIT_SHA` so each deploy
gets fresh `_next/static` hashes.

## The simpler alternative

Setting **Root Directory to `apps/trader`** in the Vercel project settings
(Settings, then Build and Deployment) makes all of the above unnecessary.
Vercel then reads `apps/trader/package.json` directly, detects Next.js with no
help, and installs and builds in the right place. If the committed config ever
gives trouble, switch to this and delete `vercel.json` and the root `next`
entry.

## Environment variables to set on the host

Only the public brand values are committed, in `apps/trader/.env.production`,
because `NEXT_PUBLIC_*` variables are inlined into the browser bundle during the
build and the site would otherwise ship with the white-label defaults.

These are deployment-specific and must be set in the Vercel project:

```
GATEWAY_INTERNAL_URL=https://your-backend-host
NEXT_PUBLIC_WS_URL=wss://your-backend-host
```

`GATEWAY_INTERNAL_URL` is where `/api/v1/*` and `/api/algo/*` are proxied. Without
it the proxy falls back to `http://127.0.0.1:8000`, which on a deployed server
means every API call fails. `NEXT_PUBLIC_WS_URL` is baked in at build time, so
set it **before** triggering the build, not after.

Marketing pages render fine without either. Login, the client area and the web
terminal do not.

## Verifying a change locally before pushing

Run the exact command Vercel runs, with the Vercel code paths active:

```bash
VERCEL=1 npm --prefix apps/trader run build
```

It should exit 0, write `apps/trader/.next`, and create no `.next/standalone`
directory.
