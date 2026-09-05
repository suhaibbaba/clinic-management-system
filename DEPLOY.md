# DEPLOY.md — sandbox deployment

The sandbox runs on a **shared VPS** that already hosts other projects behind a
host-level nginx. This stack therefore ships **no reverse proxy and no TLS**,
and **nothing it publishes listens on a public interface** — every published
port binds to `127.0.0.1` and the host nginx reaches it over loopback.

|                  |                                                            |
| ---------------- | ---------------------------------------------------------- |
| Web app          | <https://clinic-sandbox.organza-moda.com>                  |
| API              | <https://clinic-sandbox.organza-moda.com/api>              |
| S3 (MinIO)       | <https://clinic-sandbox-s3.organza-moda.com>               |
| Server directory | `/opt/clinic/sandbox`                                      |
| Compose project  | `clinic-sandbox`                                           |
| Images           | `ghcr.io/<owner>/clinic-api`, `ghcr.io/<owner>/clinic-web` |

```
push to main ─▶ build & push images to GHCR ─▶ scp compose file ─▶ pull & up -d ─▶ curl /api/health
```

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

No registry secret is needed: the build job authenticates to GHCR with the
automatic `GITHUB_TOKEN`.

Generate a deploy key for this purpose only, rather than reusing a personal one:

```bash
ssh-keygen -t ed25519 -C 'github-actions clinic sandbox' -f ~/.ssh/clinic_sandbox -N ''
ssh-copy-id -i ~/.ssh/clinic_sandbox.pub <user>@<host>   # public half onto the server
cat ~/.ssh/clinic_sandbox                                # private half into SANDBOX_SSH_KEY
```

## 2. GHCR package visibility (one-time, manual)

The repository is public, but **packages pushed to GHCR start out private**, and
the `GITHUB_TOKEN` the workflow uses cannot change package visibility — that
needs an owner-level admin action. Do it once, after the first successful build:

1. <https://github.com/users/suhaibbaba/packages> (or the organisation's
   Packages tab)
2. open `clinic-api` → **Package settings** → **Danger Zone** → **Change
   visibility** → **Public**
3. repeat for `clinic-web`

Until then the server cannot `docker compose pull`. If the packages are
deliberately kept private, log the server in once instead — with a PAT that has
`read:packages` only:

```bash
echo '<PAT>' | docker login ghcr.io -u <github-username> --password-stdin
```

Also worth doing once per package: **Package settings → Manage Actions access →
add this repository with `Write`**, so the workflow keeps push rights if the
package is ever detached from the repo.

## 3. Server prerequisites

### Docker

```bash
docker --version          # 24+ with the compose plugin
docker compose version
id -nG <user> | grep docker   # the deploy user must be in the docker group
```

### Directory and environment file

```bash
sudo mkdir -p /opt/clinic/sandbox
sudo chown <user>:<user> /opt/clinic/sandbox
```

Copy [`.env.sandbox.example`](./.env.sandbox.example) from this repository to
`/opt/clinic/sandbox/.env`, then fill in real values:

```bash
$EDITOR /opt/clinic/sandbox/.env
chmod 600 /opt/clinic/sandbox/.env
```

```bash
openssl rand -base64 48   # JWT_SECRET
openssl rand -hex 24      # POSTGRES_PASSWORD, STORAGE_SECRET_ACCESS_KEY
```

This one file is read twice: as `env_file` for the containers, and as Compose's
project `.env` for the `${...}` substitutions in the compose file. It is created
by hand, never by CI, and never committed — the deploy fails with a pointer back
here if it is missing.

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

## 4. Deploying

Automatic on every push to `main`, and on demand from **Actions → Deploy sandbox
→ Run workflow**.

By hand on the server:

```bash
cd /opt/clinic/sandbox
docker compose -p clinic-sandbox pull
docker compose -p clinic-sandbox up -d
```

The API container runs Drizzle migrations to completion before it starts
listening, so the sandbox never serves traffic against an un-migrated database.
With `SEED_ON_BOOT=true` in `.env` it also runs the seed, which is idempotent.

### Rolling back

Every build is tagged with its commit SHA as well as `sandbox`. Pin one:

```bash
cd /opt/clinic/sandbox
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=<full-40-char-sha>/' .env
docker compose -p clinic-sandbox pull
docker compose -p clinic-sandbox up -d
```

Set `IMAGE_TAG=sandbox` again to resume following `main`. Note that migrations
only ever roll forward — rolling the images back does not roll the schema back.

## 5. Logs and status

```bash
cd /opt/clinic/sandbox

docker compose -p clinic-sandbox ps
docker compose -p clinic-sandbox logs -f            # everything
docker compose -p clinic-sandbox logs -f api        # one service
docker compose -p clinic-sandbox logs --tail=200 api
docker compose -p clinic-sandbox logs -f backup     # next scheduled dump

# Health, from the server and from outside.
curl -s http://127.0.0.1:15000/health
curl -s https://clinic-sandbox.organza-moda.com/api/health

# A psql shell (the database has no host port; go in through the container).
docker compose -p clinic-sandbox exec postgres \
  psql -U "$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2)" \
       -d "$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2)"
```

## 6. Backups

The `backup` service dumps the database every night at `BACKUP_AT_UTC`
(default 02:15 UTC) into the `clinic_backups` volume as
`clinic-YYYYmmdd-HHMMSS.sql.gz`, and deletes dumps older than
`BACKUP_KEEP_DAYS` (default 7) after each run.

```bash
cd /opt/clinic/sandbox

# What is stored.
docker compose -p clinic-sandbox exec backup ls -lh /backups

# Take one now, off-schedule.
docker compose -p clinic-sandbox run --rm backup once

# Copy a dump off the server.
docker compose -p clinic-sandbox cp backup:/backups/clinic-20260905-021500.sql.gz .
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
docker compose -p clinic-sandbox stop api web

# 2. Take a dump of the current state first — restores go wrong.
docker compose -p clinic-sandbox run --rm backup once

# 3. Drop and recreate the schema, then load the dump.
docker compose -p clinic-sandbox exec postgres \
  psql -U "$user" -d "$db" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'

docker compose -p clinic-sandbox exec -T postgres \
  sh -c "gunzip -c /backups/clinic-20260905-021500.sql.gz | psql -U '$user' -d '$db'"

# 4. Back up.
docker compose -p clinic-sandbox start api web
curl -s https://clinic-sandbox.organza-moda.com/api/health
```

Step 3's second command needs the dump visible to the `postgres` container. It
is not mounted there by default — either add `clinic_backups:/backups:ro` to the
postgres service, or pipe from the host:

```bash
docker compose -p clinic-sandbox cp backup:/backups/clinic-20260905-021500.sql.gz /tmp/restore.sql.gz
gunzip -c /tmp/restore.sql.gz | \
  docker compose -p clinic-sandbox exec -T postgres psql -U "$user" -d "$db"
rm -f /tmp/restore.sql.gz
```

The API applies any migrations the restored dump predates on its next start.

## 7. Troubleshooting

| Symptom                                           | Cause                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Deploy fails: `missing /opt/clinic/sandbox/.env`  | Step 3 was skipped                                                                 |
| `docker compose pull` → `denied` / `unauthorized` | GHCR packages still private — section 2                                            |
| `502` from nginx                                  | Container down or not yet healthy: `docker compose -p clinic-sandbox ps`           |
| Healthcheck step fails with `"database":"down"`   | `DATABASE_URL` and `POSTGRES_PASSWORD` disagree, or postgres failed to start       |
| Uploads fail with `SignatureDoesNotMatch`         | The S3 block rewrites `Host`, or `STORAGE_ENDPOINT` is not the public hostname     |
| Uploads fail with `413`                           | `client_max_body_size` on the S3 server block                                      |
| Presigned URL times out from the browser          | DNS for `clinic-sandbox-s3.organza-moda.com` or the S3 block is missing            |
| API logs `getaddrinfo ENOTFOUND` for the S3 host  | Container cannot resolve the public hostname — see "Why the S3 hostname is public" |
| Port already in use on 15000/15080/15900          | Another project took it; these are fixed, so free the port rather than changing it |

**No credentials belong in this file, in the repository, or in a workflow log.**
Everything secret lives in `/opt/clinic/sandbox/.env` on the server and in
GitHub Actions secrets.
