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
push to main ─▶ ssh ─▶ git reset --hard origin/main ─▶ compose build ─▶ up -d ─▶ curl /api/health
```

There is no registry in the loop. The VPS holds this repository at
`/opt/clinic/sandbox` and builds both images in place, so a deploy is a
fast-forward of that checkout followed by a rebuild.

## Port map

Fixed in `docker-compose.sandbox.yml`, because the machine is shared and these
numbers are what the host nginx is configured against.

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
openssl rand -base64 48   # JWT_SECRET
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

To rebuild one service only:

```bash
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml build api
docker compose -p clinic-sandbox -f docker-compose.sandbox.yml up -d api
```

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

| Symptom                                          | Cause                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Deploy fails: `missing /opt/clinic/sandbox/.env` | Section 2 was skipped                                                                                  |
| Deploy fails: `not a git checkout`               | `/opt/clinic/sandbox` is not a clone of this repository — section 2                                    |
| Deploy fails during `build`                      | Read the step's log: it is a real build error, the same one `pnpm build` would give                    |
| Build killed, or the box goes unresponsive       | Out of RAM. Give the VPS swap, or build one service at a time                                          |
| `no configuration file provided`                 | A compose call without `-f docker-compose.sandbox.yml`                                                 |
| Compose acts on the wrong services               | Same cause: a bare call picks up `docker-compose.yml`, the development stack                           |
| `502` from nginx                                 | Container down or not yet healthy: `docker compose -p clinic-sandbox -f docker-compose.sandbox.yml ps` |
| Healthcheck step fails with `"database":"down"`  | `DATABASE_URL` and `POSTGRES_PASSWORD` disagree, or postgres failed to start                           |
| Uploads fail with `SignatureDoesNotMatch`        | The S3 block rewrites `Host`, or `STORAGE_ENDPOINT` is not the public hostname                         |
| Uploads fail with `413`                          | `client_max_body_size` on the S3 server block                                                          |
| Presigned URL times out from the browser         | DNS for `clinic-sandbox-s3.organza-moda.com` or the S3 block is missing                                |
| API logs `getaddrinfo ENOTFOUND` for the S3 host | Container cannot resolve the public hostname — see "Why the S3 hostname is public"                     |
| Port already in use on 15000/15080/15900         | Another project took it; these are fixed, so free the port rather than changing it                     |

**No credentials belong in this file, in the repository, or in a workflow log.**
Everything secret lives in `/opt/clinic/sandbox/.env` on the server and in
GitHub Actions secrets.
