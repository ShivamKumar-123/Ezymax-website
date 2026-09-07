# Deploying FXArtha

Production runs on a single host at `/opt/fxartha`, as Docker Compose services
behind nginx. `deploy.sh` does the work; the GitHub Actions workflow is a
trigger and an audit trail around it.

## How a deploy is decided

`deploy.sh` diffs the deployed commit against the target and rebuilds only what
that diff touches. The mapping lives in `services_for_path`. Two rules in it are
not obvious:

- Anything under `backend/packages/` rebuilds **all** backend services — they
  share that package.
- A change to `docker-compose*.yml` or `.env` rebuilds **everything**, because
  either can change any service's configuration.

Two more decisions worth knowing about:

- Frontends build with `--no-cache`. Docker's `COPY` layer cache has shipped a
  stale bundle here before: the cache key did not notice a file that arrived
  after the entry was made, and the container came up serving old JavaScript
  while every version check said it was current.
- Every container is recreated with `--force-recreate`, backend included. The
  backend code is bind-mounted so `restart` would pick it up — but `restart`
  does **not** re-read `.env`, and an environment change that silently fails to
  apply is a worse outcome than a few seconds of recreate.

A deploy that fails any check rolls the working tree back and restarts the
previous containers.

## Running one

From GitHub: **Actions → Deploy → Run workflow**. Optionally give a ref (a tag,
or a commit to roll back to) and tick *force_all* to rebuild everything.

There is deliberately no deploy on push. This code moves client money; someone
picks the moment.

By hand on the host, identically:

```bash
cd /opt/fxartha
./deploy/deploy.sh                  # origin/main
./deploy/deploy.sh v1.4.2           # a tag
FORCE_ALL=1 ./deploy/deploy.sh      # rebuild everything
```

## One-time setup

**1. Deploy key — lets the server pull without a personal token.**

The keypair is already generated at `/root/.ssh/fxartha_deploy`. Add the public
half to GitHub → repo **Settings → Deploy keys → Add deploy key**, read-only:

```bash
ssh root@<host> cat /root/.ssh/fxartha_deploy.pub
```

Confirm it works:

```bash
ssh root@<host> 'cd /opt/fxartha && git fetch origin && echo OK'
```

**2. Actions → server key.**

Generated at `/root/.ssh/fxartha_ci`, and its public half is already in the
server's `authorized_keys`. Put the **private** half in GitHub → **Settings →
Secrets and variables → Actions**, as `DEPLOY_SSH_KEY`. Read it in your own
terminal and paste it — never through a chat window or an issue:

```bash
ssh root@<host> cat /root/.ssh/fxartha_ci
```

Add alongside it:

| Secret | Value |
| --- | --- |
| `DEPLOY_SSH_KEY` | contents of `/root/.ssh/fxartha_ci` (the private key) |
| `DEPLOY_HOST` | the server's IP or hostname |
| `DEPLOY_USER` | `root` |

**3. Require an approver.**

GitHub → **Settings → Environments → New environment → `production`** → tick
**Required reviewers** and add yourself. The deploy job then waits for a human
before it touches the host.

**4. Turn off password SSH.**

Once step 2 is confirmed working, key auth makes the password redundant, and
leaving it enabled leaves the weaker path open. In `/etc/ssh/sshd_config`:

```
PasswordAuthentication no
```

then `systemctl reload sshd`. Keep an open session while you test a new one, so
a mistake here cannot lock you out.

## What CI checks before any of this

`.github/workflows/ci.yml`, on every push and PR to `main`:

- **Secret scan** — gitleaks over the working tree, allowlist in `.gitleaks.toml`
- **Backend** — every `.py` file parsed, then the models and schemas packages
  imported for real and the ORM table count printed
- **Frontend** — trader, admin, landing and ib: `tsc --noEmit`, then
  `next build`; trader also runs its vitest suite. Each app installs with the
  package manager its own Dockerfile uses — yarn for landing, npm for the other
  three — so a green run means the dependency tree production will build.

`next lint` is not wired up: no app has an ESLint config, so it drops into an
interactive setup prompt and would hang the runner. Worth adding once one exists.
