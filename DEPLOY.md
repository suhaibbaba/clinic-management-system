# DEPLOY.md — sandbox deployment

The sandbox runs on a **shared VPS** that already hosts other projects behind a
host-level nginx. This stack therefore ships **no reverse proxy and no TLS**,
and **nothing it publishes listens on a public interface** — every published
port binds to `127.0.0.1` and the host nginx reaches it over loopback.

|                  |                                                                 |
| ---------------- | --------------------------------------------------------------- |
| Web app          | <https://clinic-sandbox.organza-moda.com>                       |
| API              | <https://clinic-sandbox.organza-moda.com/api>                   |
| S3 (MinIO)       | <https://clinic-sandbox-s3.organza-moda.com>                    |
| Server directory | `/opt/clinic/sandbox`                                           |
| Compose project  | `clinic-sandbox`                                                |
| Images           | built on the server: `clinic-sandbox-api`, `clinic-sandbox-web` |

```
manual run ─▶ ssh ─▶ git reset --hard origin/main ─▶ resolve APP_VERSION
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
`/opt/clinic/sandbox` and builds both images in place, so a deploy is a
fast-forward of that checkout followed by a rebuild.

## Port map

Fixed per environment, because the machine is shared and these numbers are what
the host nginx is configured against. The sandbox uses the defaults in
`docker-compose.sandbox.yml`; another environment sets `STACK_API_PORT`,
`STACK_WEB_PORT` and `STACK_S3_PORT` in its own `.env` (see [Another clinic in its own environment](#another-clinic-in-its-own-environment)).

| Service       | Host binding      | Container | Public?             |
| ------------- | ----------------- | --------- | ------------------- |
| `web`         | `127.0.0.1:15080` | `80`      | via nginx           |
| `api`         | `127.0.0.1:15000` | `3000`    | via nginx (`/api/`) |
| `minio`       | `127.0.0.1:15900` | `9000`    | via nginx (S3 host) |
| `postgres`    | — none —          | `5432`    | no                  |
| MinIO console | — none —          | `9001`    | no                  |

> The API process binds `0.0.0.0` **inside its container** (`HOST=0.0.0.0`) so
> the web container can reach it on the Docker network. That is not a public
> bind: the container's port is published only to `127.0.0.1:15000`. Check with
> `ss -tlnp | grep 150` — every line should read `127.0.0.1:`.

## 1. GitHub secrets

Repository → Settings → Secrets and variables → Actions.

| Secret             | Required | What it is                                                             |
| ------------------ | -------- | ---------------------------------------------------------------------- |
| `SANDBOX_HOST`     | yes      | VPS hostname or IP the runner connects to                              |
| `SANDBOX_USER`     | yes      | SSH user; must be in the `docker` group and own `/opt/clinic/sandbox`  |
| `SANDBOX_SSH_KEY`  | yes      | **Private** key, PEM, whole file including the header and footer lines |
| `SANDBOX_SSH_PORT` | no       | SSH port; defaults to 22                                               |

No registry secret is needed — nothing is pushed or pulled from a registry.

Generate a deploy key for this purpose only, rather than reusing a personal one:

```bash
ssh-keygen -t ed25519 -C 'github-actions clinic sandbox' -f ~/.ssh/clinic_sandbox -N ''
ssh-copy-id -i ~/.ssh/clinic_sandbox.pub <user>@<host>   # public half onto the server
cat ~/.ssh/clinic_sandbox                                # private half into SANDBOX_SSH_KEY
```

## 2. Server prerequisites

### Docker

```bash
docker --version          # 24+ with the compose plugin
docker compose version
id -nG <user> | grep docker   # the deploy user must be in the docker group
```

### The repository, cloned at `/opt/clinic/sandbox`

The images are built on the server, so the server needs the sources. The deploy
does `git fetch origin main && git reset --hard origin/main` in this directory
and refuses to run if it is not a git checkout.

```bash
sudo mkdir -p /opt/clinic
sudo chown <user>:<user> /opt/clinic

git clone https://github.com/suhaibbaba/clinic-management-system.git /opt/clinic/sandbox
cd /opt/clinic/sandbox
git checkout main
```

The repository is public, so a read-only HTTPS clone needs no credentials on the
server. The deploy only ever reads from the remote — it never pushes — and it
holds no local commits, which is why the reset can be hard.

Build resources are worth a thought on a shared box: the first build compiles
the whole workspace twice (once per image) and wants roughly 2 GB of free RAM
and a few GB of disk. Later builds reuse Docker's layer cache and are much
quicker, but `docker image prune -f` at the end of each deploy is what stops the
superseded layers accumulating.

### Environment file

```bash
cd /opt/clinic/sandbox
cp .env.sandbox.example .env
chmod 600 .env
$EDITOR .env
```

```bash
openssl rand -base64 48   # JWT_SECRET, BOOKING_TOKEN_SECRET
openssl rand -hex 24      # POSTGRES_PASSWORD, STORAGE_SECRET_ACCESS_KEY
```

This one file is read twice: as `env_file` for the containers, and as Compose's
project `.env` for the `${...}` substitutions in the compose file. It is created
by hand, never by CI, and never committed — the deploy fails with a pointer back
here if it is missing.

`.env` is gitignored, so it sits inside the checkout without ever being tracked
and the deploy's `git reset --hard` leaves it alone.

`DATABASE_URL` embeds `POSTGRES_PASSWORD`; change both together or the API will
not connect.

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

### nginx server blocks

These belong to the **host** nginx, not to this stack. Add them alongside the
other projects' blocks and reload.

**App — `clinic-sandbox.organza-moda.com`**

```nginx
server {
    server_name clinic-sandbox.organza-moda.com;

    # TLS as configured for the other sites on this host (certbot, etc.)

    # One upstream: the web container's own nginx serves the SPA and proxies
    # /api/ to the API container, so /api/* needs no separate block.
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

To send API traffic straight to the API container instead — one hop fewer, and
what you want if `/api` ever needs its own timeouts — add this block _above_
`location /`. The trailing slash on `proxy_pass` is what strips the `/api`
prefix, exactly as the web image's nginx does:

```nginx
    location /api/ {
        proxy_pass http://127.0.0.1:15000/;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

**S3 — `clinic-sandbox-s3.organza-moda.com`**

```nginx
server {
    server_name clinic-sandbox-s3.organza-moda.com;

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

### The clinic's website on its own domain

A clinic with the `website` module gets a public site, edited on the dashboard's **Website** page.
It answers at `/site/<slug>` on any host. To put it on the clinic's own domain, with the dashboard on
`admin.` of the same domain:

1. Point both names at the server and add them to the TLS certificate.
2. Switch the module on and record the domain (no `www.`, no port):

   ```sh
   pnpm -C apps/api module:enable <clinic slug> website
   docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
     -c "update clinics set site_domain = 'abuobaidclinic.ps' where slug = '<clinic slug>'"
   ```

3. Add two host nginx blocks. They differ in one header: `X-Clinic-Entry: site` tells the web
   container to answer every page of that host with the website instead of the dashboard. `/api/`,
   `/book/…` and the booking manage links keep working on both.

```nginx
server {
    server_name admin.abuobaidclinic.ps;

    # TLS as above.

    location / {
        proxy_pass http://127.0.0.1:15080;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    server_name abuobaidclinic.ps www.abuobaidclinic.ps;

    # TLS as above.

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

The page's `<head>` (title, description, preview picture and the clinic's structured data) is filled
by the web container through SSI from `/api/public/site/head`, so search engines and chat previews
read the published text without running the bundle. Nothing shows until the admin publishes once.

### Why the S3 hostname is public

`STORAGE_ENDPOINT` is set to `https://clinic-sandbox-s3.organza-moda.com`, not
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

## Another clinic in its own environment

A clinic that must not share a database with the sandbox gets its own environment: its own
checkout, `.env`, Postgres, MinIO, containers, images and backups, from the same
`docker-compose.sandbox.yml`. Nothing is shared but the host nginx and the code on `main`.

| Environment     | Directory                   | Compose project        | Ports (api / web / s3) | Dashboard                              | Website                          | S3                                   |
| --------------- | --------------------------- | ---------------------- | ---------------------- | -------------------------------------- | -------------------------------- | ------------------------------------ |
| `sandbox`       | `/opt/clinic/sandbox`       | `clinic-sandbox`       | 15000 / 15080 / 15900  | `clinic-sandbox.organza-moda.com`      | `/site/abu-obeid`                | `clinic-sandbox-s3.organza-moda.com` |
| `kossai-jarrar` | `/opt/clinic/kossai-jarrar` | `clinic-kossai-jarrar` | 16000 / 16080 / 16900  | `admin.kossai-jarrar.organza-moda.com` | `kossai-jarrar.organza-moda.com` | `kossai-jarrar-s3.organza-moda.com`  |

A second stack is a second Postgres, MinIO, API and web on the same box: check `free -h` before
adding one.

### 1. DNS

Three `A` records to the VPS, **DNS only** like every other record here, so certbot on the server
issues the certificate: the website, `admin.` of it, and the S3 host.

### 2. The checkout and its `.env`

```bash
git clone https://github.com/suhaibbaba/clinic-management-system.git /opt/clinic/kossai-jarrar
cd /opt/clinic/kossai-jarrar
cp .env.kossai-jarrar.example .env
chmod 600 .env
$EDITOR .env
```

Fill every `CHANGE_ME` with values of its own — never the sandbox's secrets. `STACK_NAME` and the
three ports must match the table above. The `BOOTSTRAP_*` block describes the clinic:

- `SEED_ON_BOOT=false` — a real clinic never gets the demo seed.
- `BOOTSTRAP_ON_BOOT=true` — after migrations, `dist/database/bootstrap.js` creates the clinic, its
  specialties, its default lists and its first admin. Later boots find them and change nothing, so
  the block can stay; a clinic renamed on the dashboard keeps its new name.
- `BOOTSTRAP_ADMIN_PASSWORD` is read only when the admin is created. With
  `NOTIFICATIONS_PROVIDER=log` a sign-in code reaches only the API log, so the first sign-in is by
  password; the admin changes it from the profile page.

### 3. TLS and nginx

```bash
sudo certbot certonly --nginx -d kossai-jarrar.organza-moda.com \
  -d admin.kossai-jarrar.organza-moda.com -d kossai-jarrar-s3.organza-moda.com
```

Three blocks, the same as the sandbox's with this environment's ports: the dashboard on `admin.`,
the website with `X-Clinic-Entry: site`, and the S3 host.

```nginx
server {
    server_name admin.kossai-jarrar.organza-moda.com;

    # TLS from the certificate above.

    location / {
        proxy_pass http://127.0.0.1:16080;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    server_name kossai-jarrar.organza-moda.com;

    # TLS from the certificate above.

    location / {
        proxy_pass http://127.0.0.1:16080;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Clinic-Entry    site;
    }
}

server {
    server_name kossai-jarrar-s3.organza-moda.com;

    # TLS from the certificate above.

    client_max_body_size 512m;
    proxy_request_buffering off;

    location / {
        proxy_pass http://127.0.0.1:16900;
        proxy_http_version 1.1;
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

### 4. Deploy

Actions → **Deploy** → `target: kossai-jarrar`. The same workflow, against this directory and
project; the health check goes through `https://admin.kossai-jarrar.organza-moda.com/api/health`.
`reset_data` and `sample_website` are refused for any target but `abu-obaid` (the sandbox). By hand:

```bash
cd /opt/clinic/kossai-jarrar
docker compose -p clinic-kossai-jarrar -f docker-compose.sandbox.yml up -d --build
docker compose -p clinic-kossai-jarrar -f docker-compose.sandbox.yml logs api | grep -A4 '^Clinic:'
```

A new environment is a row in the workflow's **Resolve the environment** step, a checkout, an
`.env` from its own example, and the steps above.

## 3. Deploying

Automatic on every push to `main`, and on demand from **Actions → Deploy sandbox
→ Run workflow**.

By hand on the server — the same three steps the workflow runs:

```bash
cd /opt/clinic/sandbox
git pull origin main

docker compose -p clinic-sandbox -f docker-compose.sandbox.yml build --pull
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml up -d --remove-orphans
docker image prune -f
```

Pass `-f docker-compose.sandbox.yml` to every compose call. Without it Compose
picks up `docker-compose.yml` — the development stack — which is a different set
of services on different ports.

`--pull` refreshes the base images, so a rebuild also picks up security updates
to `node:22-alpine` and `nginx:alpine` instead of sitting on whatever was cached
the first time. Drop it if you only want to rebuild the application layers.

The API container runs Drizzle migrations to completion before it starts
listening, so the sandbox never serves traffic against an un-migrated database.
With `SEED_ON_BOOT=true` in `.env` it also runs the seed, which is idempotent.
It fills only what is empty, so a clinic whose website was already saved keeps it. To put the
sample website (text, pictures, doctor profiles) over a saved one without wiping anything else,
run the deploy with `sample_website` set to `WEBSITE`, or on the server:
`docker compose -p clinic-sandbox -f docker-compose.sandbox.yml exec -T api node dist/database/apply-sample-website.js [slug]`.

To rebuild one service only:

```bash
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml build api
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml up -d api
```

### Starting the sandbox's data over

**Actions → Deploy sandbox → Run workflow → `target: abu-obaid` → type `RESET` in "Wipe the
abu-obaid database and object store before deploying".** Anything other than that exact
word is refused before the job touches the server, and a push to `main` can
never reach it.

The reason this exists rather than "just re-run the seed": the seed only ever
populates an **empty** clinic. Every module returns early once its own rows are
there, and `upsertSeedClinic` deliberately leaves an adopted clinic's address,
currency and settings alone — those are things a practice edits about itself.
That is right for a real deployment and it means **changing the seed cannot
change what the sandbox already shows**. Only a wipe can.

What the job does, in order:

1. refuses unless `SEED_ON_BOOT=true` is in `.env` — a wipe that will not be
   re-seeded leaves a sandbox nobody can sign into, which is worse than
   whatever it was run to fix;
2. takes a dump (`backup once`), so the wipe is recoverable for as long as the
   backups are kept;
3. `down`, then removes `clinic-sandbox_clinic_pg_data` and
   `clinic-sandbox_clinic_minio_data` — **not** `clinic_backups`, which is why
   it does not use `down -v`;
4. runs the ordinary deploy, which recreates both volumes, migrates, and seeds
   into an empty database.

The same thing by hand, if Actions is not available:

```bash
cd /opt/clinic/sandbox
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml run --rm backup once
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml down
docker volume rm clinic-sandbox_clinic_pg_data clinic-sandbox_clinic_minio_data
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml up -d
```

Removing the MinIO volume alongside the database keeps the two in step: the
rows that point at an X-ray or a staff photo are going, so the objects they
name should go with them rather than linger as orphans nothing can reach.

### Rolling back

Which build is running is decided by which commit is checked out, so a rollback
is a checkout and a rebuild:

```bash
cd /opt/clinic/sandbox
git fetch origin main
git checkout <sha>            # detached HEAD is expected and fine here

docker compose -p clinic-sandbox -f docker-compose.sandbox.yml build
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml up -d --remove-orphans
```

`git checkout main` and rebuild to come back. Nothing is pinned in `.env`, so
the next deploy from Actions resets the checkout to `origin/main` and undoes the
rollback — hold a rollback by not deploying, or by reverting the offending
commit on `main` so the two agree.

Migrations only ever roll forward: checking the code out at an older commit does
not roll the schema back. If the bad deploy migrated the database, restore a
dump as well (section 5).

## 4. Logs and status

```bash
cd /opt/clinic/sandbox
alias dc='docker compose -p clinic-sandbox -f docker-compose.sandbox.yml'

dc ps
dc logs -f            # everything
dc logs -f api        # one service
dc logs --tail=200 api
dc logs -f backup     # next scheduled dump

# Which commit is deployed.
git log -1 --oneline

# Health, from the server and from outside.
curl -s http://127.0.0.1:15000/health
curl -s https://clinic-sandbox.organza-moda.com/api/health

# A psql shell (the database has no host port; go in through the container).
dc exec postgres \
  psql -U "$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2)" \
       -d "$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2)"

# Vendor console accounts (the console is /vendor on the dashboard host). The password comes from
# VENDOR_PASSWORD, never the command line; at least 12 characters.
dc exec -e VENDOR_PASSWORD='…' api node scripts/vendor-user.mjs create you@example.com "Your Name"
dc exec api node scripts/vendor-user.mjs list
dc exec -e VENDOR_PASSWORD='…' api node scripts/vendor-user.mjs password you@example.com
dc exec api node scripts/vendor-user.mjs disable you@example.com

# Paid modules per clinic without a subscription (with one, the console computes them).
dc exec api node scripts/clinic-module.mjs list
dc exec api node scripts/clinic-module.mjs enable abu-obeid assistant
dc exec api node scripts/clinic-module.mjs disable abu-obeid assistant

# Specialties per clinic (paid too, so the vendor's switch: an admin can only rename one).
# Enabling adds the specialty's built-in list rows and its starter pack; disabling keeps
# its procedures and records. Remove it from BOOTSTRAP_SPECIALTIES as well, or the next
# boot grants it again.
dc exec api node dist/database/clinic-specialty.js list
dc exec api node dist/database/clinic-specialty.js enable abu-obeid orthopedic
dc exec api node dist/database/clinic-specialty.js disable abu-obeid orthopedic
```

The alias is only for this section's brevity; the commands elsewhere are written
out in full.

## 5. Backups

The `backup` service dumps the database every night at `BACKUP_AT_UTC`
(default 02:15 UTC) into the `clinic_backups` volume as
`clinic-YYYYmmdd-HHMMSS.sql.gz`, and deletes dumps older than
`BACKUP_KEEP_DAYS` (default 7) after each run.

```bash
cd /opt/clinic/sandbox

# What is stored.
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml exec backup ls -lh /backups

# Take one now, off-schedule.
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml run --rm backup once

# Copy a dump off the server.
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml cp backup:/backups/clinic-20260905-021500.sql.gz .
```

Dumps live in a Docker volume on the same disk as the database, so they survive
`docker compose down` and a container rebuild — but not the machine. Copy
anything you would be sorry to lose somewhere else.

Compose prefixes volume names with the project, so on the host the three
volumes are `clinic-sandbox_clinic_pg_data`, `clinic-sandbox_clinic_minio_data`
and `clinic-sandbox_clinic_backups`. That prefix is what keeps them from
colliding with the other projects on this VPS — do not strip it.

```bash
docker volume ls | grep clinic-sandbox
```

### Restoring

Destructive: this drops the current schema. Stop the API first so nothing writes
mid-restore.

```bash
cd /opt/clinic/sandbox
user=$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2)
db=$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2)

# 1. Stop the writers, leave postgres up.
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml stop api web

# 2. Take a dump of the current state first — restores go wrong.
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml run --rm backup once

# 3. Drop and recreate the schema, then load the dump.
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml exec postgres \
  psql -U "$user" -d "$db" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'

docker compose -p clinic-sandbox -f docker-compose.sandbox.yml exec -T postgres \
  sh -c "gunzip -c /backups/clinic-20260905-021500.sql.gz | psql -U '$user' -d '$db'"

# 4. Back up.
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml start api web
curl -s https://clinic-sandbox.organza-moda.com/api/health
```

Step 3's second command needs the dump visible to the `postgres` container. It
is not mounted there by default — either add `clinic_backups:/backups:ro` to the
postgres service (the compose file is on the server now, so that is a local
edit; commit it if you want it to survive the next deploy's reset), or pipe from
the host:

```bash
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml cp backup:/backups/clinic-20260905-021500.sql.gz /tmp/restore.sql.gz
gunzip -c /tmp/restore.sql.gz | \
  docker compose -p clinic-sandbox -f docker-compose.sandbox.yml exec -T postgres psql -U "$user" -d "$db"
rm -f /tmp/restore.sql.gz
```

The API applies any migrations the restored dump predates on its next start.

## 6. Troubleshooting

| Symptom                                                     | Cause                                                                                                                      |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Deploy fails: `never accepted a TCP connection on port 22`  | The VPS was unreachable for six minutes. Check the host is up and that nothing (firewall, fail2ban) is dropping the runner |
| Deploy fails: `dial tcp …:22: i/o timeout`                  | An older run, before the workflow waited for port 22 — re-run it                                                           |
| Deploy fails: `missing /opt/clinic/sandbox/.env`            | Section 2 was skipped                                                                                                      |
| Deploy fails: `not a git checkout`                          | `/opt/clinic/sandbox` is not a clone of this repository — section 2                                                        |
| Deploy fails during `build`                                 | Read the step's log: it is a real build error, the same one `pnpm build` would give                                        |
| Build killed, or the box goes unresponsive                  | Out of RAM. Give the VPS swap, or build one service at a time                                                              |
| `no configuration file provided`                            | A compose call without `-f docker-compose.sandbox.yml`                                                                     |
| Compose acts on the wrong services                          | Same cause: a bare call picks up `docker-compose.yml`, the development stack                                               |
| `502` from nginx                                            | Container down or not yet healthy: `docker compose -p clinic-sandbox -f docker-compose.sandbox.yml ps`                     |
| Deploy fails: `container clinic-sandbox-api-1 is unhealthy` | The API container exited on boot — see below                                                                               |
| Healthcheck step fails with `"database":"down"`             | `DATABASE_URL` and `POSTGRES_PASSWORD` disagree, or postgres failed to start                                               |
| Uploads fail with `SignatureDoesNotMatch`                   | The S3 block rewrites `Host`, or `STORAGE_ENDPOINT` is not the public hostname                                             |
| Uploads fail with `413`                                     | `client_max_body_size` on the S3 server block                                                                              |
| Presigned URL times out from the browser                    | DNS for `clinic-sandbox-s3.organza-moda.com` or the S3 block is missing                                                    |
| API logs `getaddrinfo ENOTFOUND` for the S3 host            | Container cannot resolve the public hostname — see "Why the S3 hostname is public"                                         |
| Port already in use on 15000/15080/15900                    | Another project took it; these are fixed, so free the port rather than changing it                                         |

### When the API container will not start

`up -d` waits for the api service to become healthy, so a container that exits
on boot surfaces as `dependency failed to start: container clinic-sandbox-api-1
is unhealthy` — with `web` never starting. The deploy job dumps the api and
postgres logs on failure; the same thing by hand:

```bash
cd /opt/clinic/sandbox
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml ps -a
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml logs --tail=80 api
```

The container runs `migrate → (seed) → serve` under `set -e`, so it exits on the
first failure and the last lines of that log name it. The usual causes, in order
of how often they bite:

| In the log                                               | Fix                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `password authentication failed for user "clinic"`       | `DATABASE_URL` still carries the placeholder password while `POSTGRES_PASSWORD` was changed. They embed the same secret twice — change both |
| `Invalid environment variables:` followed by field names | A value in `.env` is missing or malformed; the API refuses to boot rather than half-configure itself                                        |
| `getaddrinfo ENOTFOUND postgres`                         | `DATABASE_URL` points somewhere other than the `postgres` service name                                                                      |
| A seed error                                             | Set `SEED_ON_BOOT=false` to get the API up, then investigate the seed separately                                                            |

Changing `POSTGRES_PASSWORD` after the first boot does **not** change the
password Postgres already stored in `clinic_pg_data` — the volume was
initialised with the old one. Either put it back, or drop the volume and start
clean, which on a sandbox is usually the quicker answer:

```bash
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml down
docker volume rm clinic-sandbox_clinic_pg_data
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml up -d
```

**No credentials belong in this file, in the repository, or in a workflow log.**
Everything secret lives in `/opt/clinic/sandbox/.env` on the server and in
GitHub Actions secrets.
