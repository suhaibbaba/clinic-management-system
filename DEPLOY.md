# DEPLOY.md — the server

**One install serves every clinic.** One database, one object store, one set of containers on a
**shared VPS** that already hosts other projects behind a host-level nginx. Every clinic runs the
same code, from `main`; a clinic is a row created in the vendor console, never a new environment.

This stack ships **no reverse proxy and no TLS**, and **nothing it publishes listens on a public
interface** — every published port binds to `127.0.0.1` and the host nginx reaches it over loopback.

|                  |                                                    |
| ---------------- | -------------------------------------------------- |
| Dashboard        | <https://clinic-managment.organza-moda.com>        |
| API              | <https://clinic-managment.organza-moda.com/api>    |
| Vendor console   | <https://clinic-managment.organza-moda.com/vendor> |
| S3 (MinIO)       | <https://clinic-managment-s3.organza-moda.com>     |
| Server directory | `/opt/clinic/app`                                  |
| Compose project  | `clinic`                                           |
| Compose file     | `docker-compose.server.yml`                        |
| Images           | built on the server: `clinic-api`, `clinic-web`    |

```
manual run (main) ─▶ ssh ─▶ git reset --hard origin/main ─▶ resolve APP_VERSION
                                  ─▶ compose build ─▶ up -d ─▶ curl /api/health
```

**The version is worked out here, on the server, and is not stored anywhere.**
It is `<major>.<minor>` from the root `package.json` plus the repository's
commit count — `1.0` and 312 commits reads as `1.0.312` — so it goes up on its
own with every commit that reaches `main`. Nothing bumps a file, nothing tags,
and nothing commits back to the branch, so there is no release commit for a
deploy to race.

`scripts/app-version.mjs` is the reference implementation and the deploy uses
it when the VPS has node; the workflow mirrors it in `awk` for when it does
not. Both are checked against each other by `app-version.spec.ts`.

Two consequences worth knowing:

- **The clone must not be shallow.** A shallow clone reports a commit count of
  1 forever, so the deploy unshallows before asking.
- **The number is passed in, not discovered.** `.git` is excluded from the
  Docker build context, so neither image can work it out: the API takes
  `APP_VERSION` as an environment variable and the web takes it as a build arg
  and inlines it. A container started by hand, with neither set, honestly
  reports `0.0.0-dev`.

There is no registry in the loop. The VPS holds this repository at
`/opt/clinic/app` and builds both images in place, so a deploy is a
fast-forward of that checkout followed by a rebuild.

There is no registry in the loop. The VPS holds this repository at `/opt/clinic/app` and builds
both images in place, so a deploy is a reset of that checkout followed by a rebuild.

## Port map

Fixed, because the machine is shared and these numbers are what the host nginx is configured
against. They are the defaults in `docker-compose.server.yml`.

| Service       | Host binding      | Container | Public?             |
| ------------- | ----------------- | --------- | ------------------- |
| `web`         | `127.0.0.1:15080` | `80`      | via nginx           |
| `api`         | `127.0.0.1:15000` | `3000`    | via nginx (`/api/`) |
| `minio`       | `127.0.0.1:15900` | `9000`    | via nginx (S3 host) |
| `postgres`    | — none —          | `5432`    | no                  |
| MinIO console | — none —          | `9001`    | no                  |

> The API process binds `0.0.0.0` **inside its container** (`HOST=0.0.0.0`) so the web container
> can reach it on the Docker network. That is not a public bind: the container's port is published
> only to `127.0.0.1:15000`. Check with `ss -tlnp | grep 150` — every line should read `127.0.0.1:`.

## 1. GitHub secrets

Repository → Settings → Secrets and variables → Actions.

| Secret         | Required | What it is                                                             |
| -------------- | -------- | ---------------------------------------------------------------------- |
| `VPS_HOST`     | yes      | VPS hostname or IP the runner connects to                              |
| `VPS_USER`     | yes      | SSH user; must be in the `docker` group and own `/opt/clinic/app`      |
| `VPS_SSH_KEY`  | yes      | **Private** key, PEM, whole file including the header and footer lines |
| `VPS_SSH_PORT` | no       | SSH port; defaults to 22                                               |

And one **variable** (the Variables tab beside Secrets):

| Variable   | Required | What it is                                                                     |
| ---------- | -------- | ------------------------------------------------------------------------------ |
| `SITE_URL` | yes      | The dashboard's public address, no trailing slash: the deploy health-checks it |

No registry secret is needed — nothing is pushed or pulled from a registry. Generate a deploy key
for this purpose only, rather than reusing a personal one:

```bash
ssh-keygen -t ed25519 -C 'github-actions clinic deploy' -f ~/.ssh/clinic_deploy -N ''
ssh-copy-id -i ~/.ssh/clinic_deploy.pub <user>@<host>   # public half onto the server
cat ~/.ssh/clinic_deploy                                # private half into VPS_SSH_KEY
```

## 2. Setting up the server

### Docker

```bash
docker --version          # 24+ with the compose plugin
docker compose version
id -nG <user> | grep docker   # the deploy user must be in the docker group
```

### The repository, cloned at `/opt/clinic/app`

The images are built on the server, so the server needs the sources. The deploy does
`git fetch origin main && git reset --hard FETCH_HEAD` in this directory and refuses to run if it is
not a git checkout.

```bash
sudo mkdir -p /opt/clinic
sudo chown <user>:<user> /opt/clinic
git clone https://github.com/suhaibbaba/clinic-management-system.git /opt/clinic/app
```

The repository is public, so a read-only HTTPS clone needs no credentials on the server. The deploy
only ever reads from the remote and the checkout holds no local commits, which is why the reset can
be hard.

The first build compiles the whole workspace twice (once per image) and wants roughly 2 GB of free
RAM and a few GB of disk. Later builds reuse Docker's layer cache; `docker image prune -f` at the
end of each deploy stops superseded layers accumulating.

### Environment file

```bash
cd /opt/clinic/app
cp .env.example .env
chmod 600 .env
$EDITOR .env
```

It is the same template development uses; its header lists every value the server changes. Generate
the secrets with:

```bash
openssl rand -base64 48   # JWT_SECRET, BOOKING_TOKEN_SECRET
openssl rand -hex 24      # POSTGRES_PASSWORD, STORAGE_SECRET_ACCESS_KEY
```

This one file is read twice: as `env_file` for the containers, and as Compose's project `.env` for
the `${...}` substitutions in the compose file. It is created by hand, never by CI, and never
committed — the deploy fails with a pointer back here if it is missing. It is gitignored, so the
deploy's `git reset --hard` leaves it alone.

`DATABASE_URL` embeds `POSTGRES_PASSWORD`; change both together or the API will not connect.
`SEED_ON_BOOT` and `BOOTSTRAP_ON_BOOT` stay `false`: the server starts empty and every clinic is
created from the vendor console (section 3).

#### A least-privilege database login (recommended)

By default the API connects as the Postgres superuser that owns the schema. To run
it as a login that can read and write rows but cannot change the schema or rewrite
the audit log:

1. Keep the owner for migrations — set `MIGRATION_DATABASE_URL` to what
   `DATABASE_URL` is today.
2. Set `APP_DATABASE_ROLE=clinic_app` and `APP_DATABASE_PASSWORD` (`openssl rand -hex 24`).
3. Point `DATABASE_URL` at that login:
   `postgres://clinic_app:<APP_DATABASE_PASSWORD>@postgres:5432/clinic`.

On the next start the migrator creates or updates `clinic_app`, grants it
read/write on every table, and revokes `UPDATE`, `DELETE` and `TRUNCATE` on
`audit_log` and `ai_audit_log`. With the three variables unset nothing changes.

#### Rate limits behind the proxy

The API reads the client IP from `X-Forwarded-For`, trusting only the hops named in
`TRUST_PROXY` (default: loopback and private networks — the host nginx and the web
container). Leave it unless the API sits behind a proxy on a public address, then
list that proxy's address or CIDR.

### DNS, TLS and nginx

Two `A` records to the VPS, **DNS only**, so certbot on the server issues the certificate:
`clinic-managment.organza-moda.com` and `clinic-managment-s3.organza-moda.com`.

```bash
sudo certbot certonly --nginx -d clinic-managment.organza-moda.com \
  -d clinic-managment-s3.organza-moda.com
```

These blocks belong to the **host** nginx, not to this stack.

**Dashboard — `clinic-managment.organza-moda.com`.** One upstream: the web container's own nginx
serves the SPA and the vendor console and proxies `/api/` to the API container.

```nginx
server {
    server_name clinic-managment.organza-moda.com;

    # TLS as configured for the other sites on this host (certbot).

    location / {
        proxy_pass http://127.0.0.1:15080;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**S3 — `clinic-managment-s3.organza-moda.com`**

```nginx
server {
    server_name clinic-managment-s3.organza-moda.com;

    # TLS as above.

    # X-rays go straight from the browser to MinIO through this block, so the
    # body size limit has to be the file size limit, not nginx's 1 MB default.
    client_max_body_size 512m;
    # Stream uploads through rather than spooling them to disk first.
    proxy_request_buffering off;

    location / {
        proxy_pass http://127.0.0.1:15900;
        proxy_http_version 1.1;

        # REQUIRED. The API signs presigned URLs for this hostname, and the S3
        # signature covers the Host header — rewriting it makes MinIO reject
        # every presigned URL with SignatureDoesNotMatch.
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 300;
        proxy_send_timeout    300;
        proxy_read_timeout    300;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Why the S3 hostname is public

`STORAGE_ENDPOINT` is set to `https://clinic-managment-s3.organza-moda.com`, not
`http://minio:9000`. The API signs upload and download URLs against it and hands
them to the **browser**, so it has to be an address the browser can reach.

Two consequences:

- the Host header must survive the proxy hop (above), or signatures fail. MinIO
  itself needs no configuration for this — it validates a signature against the
  Host header of the request it receives, so a URL signed for the public
  hostname verifies as long as nginx does not rewrite it;
- the API's own S3 calls — `HeadObject` when an upload is confirmed — also go
  out to the public hostname and back in through nginx. That works on any VPS
  whose containers have outbound DNS and internet access, which is the normal
  case. If the host firewall blocks the hairpin, add a `hosts:` mapping on the
  api service pointing the S3 hostname at the host's own address.

### First deploy and the vendor account

Run **Actions → Deploy** from `main` (section 4), then create the vendor's own console account. The
password comes from `VENDOR_PASSWORD`, never the command line; at least 8 characters:

```bash
cd /opt/clinic/app
docker compose -p clinic -f docker-compose.server.yml exec -e VENDOR_PASSWORD='…' api \
  node scripts/vendor-user.mjs create you@example.com "Your Name"
```

## 3. Adding a clinic

Nothing on the server changes: no checkout, no `.env`, no workflow edit.

1. Sign in to <https://clinic-managment.organza-moda.com/vendor> → **New clinic**. That writes the
   clinic, its specialties, its admin and a trial or active subscription in one go.
2. The admin signs in on the dashboard with a one-time code sent to their phone. While
   `NOTIFICATIONS_PROVIDER=log`, the code reaches only the API log:
   `docker compose -p clinic -f docker-compose.server.yml logs --tail=50 api`.

### The clinic's website on its own domain

A clinic with the `website` module gets a public site, edited on the dashboard's **Website** page.
It answers at `/site/<slug>` on any host. To put it on the clinic's own domain:

1. Point the domain (and `www.`) at the server and issue its certificate with certbot.
2. Record the domain on the clinic's page in the vendor console (**Domain**; no `www.`, no port),
   with the `website` module on.
3. Add a host nginx block. `X-Clinic-Entry: site` tells the web container to answer every page of
   that host with the website instead of the dashboard; `/api/`, `/book/…` and the booking manage
   links keep working.

```nginx
server {
    server_name abuobaidclinic.ps www.abuobaidclinic.ps;

    # TLS as configured for the other sites on this host (certbot).

    location / {
        proxy_pass http://127.0.0.1:15080;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Clinic-Entry    site;
    }
}
```

### The clinic's dashboard on its own domain

Staff can always sign in on the shared dashboard. A clinic that wants its own sign-in address — and
needs one for its own Google sign-in — gets a **dashboard domain**, such as `admin.abuobaidclinic.ps`:

1. Point it at the server and issue its certificate with certbot.
2. Record it on the clinic's page in the vendor console (**Domain** → **Dashboard domain**).
3. Add a host nginx block exactly like the shared dashboard's, with this name (no `X-Clinic-Entry`).

On that host the API knows the clinic before anybody signs in: its Google sign-in is the clinic's
own, passkeys made there belong to that host, and the clinic's emails link to it.

### The clinic's own email and Google keys

Set on the clinic's page in the vendor console, **Email & Google** tab, never by the clinic. The
secrets are sealed with `SECRETS_MASTER_KEY` (the server's `.env`), and the console shows only their
last four characters.

- **Email (Resend).** The clinic's own Resend account, with the clinic's domain verified there. A
  sender such as `Clinic <no-reply@abuobaidclinic.ps>` and the account's API key. Activation,
  password reset and sign-in code emails then go out from it; without them, the server's
  `EMAIL_PROVIDER` sends them. The vendor's own password emails always use the server's.
- **Google sign-in.** A Google Cloud OAuth client (Web application) in the clinic's own project,
  with the dashboard domain as its authorised JavaScript origin and
  `https://<dashboard domain>/api/auth/google/callback` as its authorised redirect URI — the console
  shows both. It needs the dashboard domain: Google sign-in on that host uses only the clinic's
  client, and only the clinic's own staff can sign in with it. The shared dashboard keeps the
  server's `GOOGLE_CLIENT_ID`, if one is set.

The page's `<head>` (title, description, preview picture and the clinic's structured data) is filled
by the web container through SSI from `/api/public/site/head`, so search engines and chat previews
read the published text without running the bundle. Nothing shows until the admin publishes once.

## 4. Deploying

On demand only: **Actions → Deploy → Run workflow**, from `main`. It takes no inputs, refuses any
other branch, and never touches data. By hand on the server — the same steps the workflow runs:

```bash
cd /opt/clinic/app
git fetch origin main && git reset --hard FETCH_HEAD

docker compose -p clinic -f docker-compose.server.yml build --pull
docker compose -p clinic -f docker-compose.server.yml up -d --remove-orphans
docker image prune -f
```

Pass `-f docker-compose.server.yml` to every compose call. Without it Compose picks up
`docker-compose.yml` — the development stack — which is a different set of services on different
ports.

`--pull` refreshes the base images, so a rebuild also picks up security updates to
`node:22-alpine` and `nginx:alpine`. The API container runs Drizzle migrations to completion before
it starts listening, so the server never serves traffic against an un-migrated database.

To rebuild one service only:

```bash
docker compose -p clinic -f docker-compose.server.yml build api
docker compose -p clinic -f docker-compose.server.yml up -d api
```

### Rolling back

Which build is running is decided by which commit is checked out, so a rollback
is a checkout and a rebuild:

```bash
cd /opt/clinic/app
git fetch origin main
git checkout <sha>            # detached HEAD is expected and fine here

docker compose -p clinic -f docker-compose.server.yml build
docker compose -p clinic -f docker-compose.server.yml up -d --remove-orphans
```

`git checkout main` and rebuild to come back. Nothing is pinned in `.env`, so
the next deploy from Actions resets the checkout to `origin/main` and undoes the
rollback — hold a rollback by not deploying, or by reverting the offending
commit on `main` so the two agree.

Migrations only ever roll forward: checking the code out at an older commit does
not roll the schema back. If the bad deploy migrated the database, restore a
dump as well (section 6).

## 5. Logs and status

```bash
cd /opt/clinic/app
alias dc='docker compose -p clinic -f docker-compose.server.yml'

dc ps
dc logs -f            # everything
dc logs -f api        # one service
dc logs --tail=200 api
dc logs -f backup     # next scheduled dump

# Which commit is deployed.
git log -1 --oneline

# Health, from the server and from outside.
curl -s http://127.0.0.1:15000/health
curl -s https://clinic-managment.organza-moda.com/api/health

# A psql shell (the database has no host port; go in through the container).
dc exec postgres \
  psql -U "$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2)" \
       -d "$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2)"

# Vendor console accounts (the console is /vendor on the dashboard host). The password comes from
# VENDOR_PASSWORD, never the command line; at least 8 characters.
dc exec -e VENDOR_PASSWORD='…' api node scripts/vendor-user.mjs create you@example.com "Your Name"
dc exec api node scripts/vendor-user.mjs list
dc exec -e VENDOR_PASSWORD='…' api node scripts/vendor-user.mjs password you@example.com
dc exec api node scripts/vendor-user.mjs disable you@example.com

# Paid modules per clinic without a subscription (with one, the console computes them).
dc exec api node scripts/clinic-module.mjs list
dc exec api node scripts/clinic-module.mjs enable <clinic slug> assistant
dc exec api node scripts/clinic-module.mjs disable <clinic slug> assistant

# Specialties per clinic (paid too, so the vendor's switch: an admin can only rename one).
# Enabling adds the specialty's built-in list rows and its starter pack; disabling keeps
# its procedures and records. Remove it from BOOTSTRAP_SPECIALTIES as well, or the next
# boot grants it again.
dc exec api node dist/database/clinic-specialty.js list
dc exec api node dist/database/clinic-specialty.js enable <clinic slug> orthopedic
dc exec api node dist/database/clinic-specialty.js disable <clinic slug> orthopedic
```

The alias is only for this section's brevity; the commands elsewhere are written
out in full.

## 6. Backups

The `backup` service dumps the database every night at `BACKUP_AT_UTC`
(default 02:15 UTC) into the `clinic_backups` volume as
`clinic-YYYYmmdd-HHMMSS.sql.gz`, and deletes dumps older than
`BACKUP_KEEP_DAYS` (default 7) after each run.

```bash
cd /opt/clinic/app

# What is stored.
docker compose -p clinic -f docker-compose.server.yml exec backup ls -lh /backups

# Take one now, off-schedule.
docker compose -p clinic -f docker-compose.server.yml run --rm backup once

# Copy a dump off the server.
docker compose -p clinic -f docker-compose.server.yml cp backup:/backups/clinic-20260905-021500.sql.gz .
```

Dumps live in a Docker volume on the same disk as the database, so they survive
`docker compose down` and a container rebuild — but not the machine. Copy
anything you would be sorry to lose somewhere else.

Compose prefixes volume names with the project, so on the host the three
volumes are `clinic_clinic_pg_data`, `clinic_clinic_minio_data`
and `clinic_clinic_backups`. That prefix is what keeps them from
colliding with the other projects on this VPS — do not strip it.

```bash
docker volume ls | grep clinic_
```

### Restoring

Destructive: this drops the current schema. Stop the API first so nothing writes
mid-restore.

```bash
cd /opt/clinic/app
user=$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2)
db=$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2)

# 1. Stop the writers, leave postgres up.
docker compose -p clinic -f docker-compose.server.yml stop api web

# 2. Take a dump of the current state first — restores go wrong.
docker compose -p clinic -f docker-compose.server.yml run --rm backup once

# 3. Drop and recreate the schema, then load the dump.
docker compose -p clinic -f docker-compose.server.yml exec postgres \
  psql -U "$user" -d "$db" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'

docker compose -p clinic -f docker-compose.server.yml exec -T postgres \
  sh -c "gunzip -c /backups/clinic-20260905-021500.sql.gz | psql -U '$user' -d '$db'"

# 4. Back up.
docker compose -p clinic -f docker-compose.server.yml start api web
curl -s https://clinic-managment.organza-moda.com/api/health
```

Step 3's second command needs the dump visible to the `postgres` container. It
is not mounted there by default — either add `clinic_backups:/backups:ro` to the
postgres service (the compose file is on the server now, so that is a local
edit; commit it if you want it to survive the next deploy's reset), or pipe from
the host:

```bash
docker compose -p clinic -f docker-compose.server.yml cp backup:/backups/clinic-20260905-021500.sql.gz /tmp/restore.sql.gz
gunzip -c /tmp/restore.sql.gz | \
  docker compose -p clinic -f docker-compose.server.yml exec -T postgres psql -U "$user" -d "$db"
rm -f /tmp/restore.sql.gz
```

The API applies any migrations the restored dump predates on its next start.

## 7. Troubleshooting

| Symptom                                                    | Cause                                                                                                                      |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Deploy fails: `never accepted a TCP connection on port 22` | The VPS was unreachable for six minutes. Check the host is up and that nothing (firewall, fail2ban) is dropping the runner |
| Deploy fails: `missing /opt/clinic/app/.env`               | Section 2 was skipped                                                                                                      |
| Deploy fails: `not a git checkout`                         | `/opt/clinic/app` is not a clone of this repository — section 2                                                            |
| Deploy fails during `build`                                | Read the step's log: it is a real build error, the same one `pnpm build` would give                                        |
| Build killed, or the box goes unresponsive                 | Out of RAM. Give the VPS swap, or build one service at a time                                                              |
| `no configuration file provided`                           | A compose call without `-f docker-compose.server.yml`                                                                      |
| Compose acts on the wrong services                         | Same cause: a bare call picks up `docker-compose.yml`, the development stack                                               |
| `502` from nginx                                           | Container down or not yet healthy: `docker compose -p clinic -f docker-compose.server.yml ps`                              |
| Deploy fails: `container clinic-api-1 is unhealthy`        | The API container exited on boot — see below                                                                               |
| Healthcheck step fails with `"database":"down"`            | `DATABASE_URL` and `POSTGRES_PASSWORD` disagree, or postgres failed to start                                               |
| Uploads fail with `SignatureDoesNotMatch`                  | The S3 block rewrites `Host`, or `STORAGE_ENDPOINT` is not the public hostname                                             |
| Uploads fail with `413`                                    | `client_max_body_size` on the S3 server block                                                                              |
| Presigned URL times out from the browser                   | DNS for `clinic-managment-s3.organza-moda.com` or the S3 block is missing                                                  |
| API logs `getaddrinfo ENOTFOUND` for the S3 host           | Container cannot resolve the public hostname — see "Why the S3 hostname is public"                                         |
| Port already in use on 15000/15080/15900                   | Another project took it; these are fixed, so free the port rather than changing it                                         |

### When the API container will not start

`up -d` waits for the api service to become healthy, so a container that exits
on boot surfaces as `dependency failed to start: container clinic-api-1
is unhealthy` — with `web` never starting. The deploy job dumps the api and
postgres logs on failure; the same thing by hand:

```bash
cd /opt/clinic/app
docker compose -p clinic -f docker-compose.server.yml ps -a
docker compose -p clinic -f docker-compose.server.yml logs --tail=80 api
```

The container runs `migrate → serve` under `set -e`, so it exits on the
first failure and the last lines of that log name it. The usual causes, in order
of how often they bite:

| In the log                                               | Fix                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `password authentication failed for user "clinic"`       | `DATABASE_URL` still carries the placeholder password while `POSTGRES_PASSWORD` was changed. They embed the same secret twice — change both |
| `Invalid environment variables:` followed by field names | A value in `.env` is missing or malformed; the API refuses to boot rather than half-configure itself                                        |
| `getaddrinfo ENOTFOUND postgres`                         | `DATABASE_URL` points somewhere other than the `postgres` service name                                                                      |

Changing `POSTGRES_PASSWORD` after the first boot does **not** change the
password Postgres already stored in `clinic_pg_data` — the volume was
initialised with the old one. Either put it back, or drop the volume and start
clean, which only before the first clinic has data:

```bash
docker compose -p clinic -f docker-compose.server.yml down
docker volume rm clinic_clinic_pg_data
docker compose -p clinic -f docker-compose.server.yml up -d
```

**No credentials belong in this file, in the repository, or in a workflow log.**
Everything secret lives in `/opt/clinic/app/.env` on the server and in
GitHub Actions secrets.
