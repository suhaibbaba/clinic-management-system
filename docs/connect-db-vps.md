# Connecting to the sandbox database from your machine

The sandbox Postgres publishes no port on the VPS (`docker-compose.sandbox.yml`), so it is reached
through an SSH tunnel to the container's address on the Docker network.

Replace `USER@VPS` with your SSH login, and add `-p <port>` to every `ssh` if it is not on 22.

## 1. Find the Postgres container's IP

```bash
ssh USER@VPS "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' clinic-sandbox-postgres-1"
ssh organza-moda "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' clinic-sandbox-postgres-1"

```

It prints something like `172.18.0.2`. If the container name differs, list them:

```bash
ssh USER@VPS "docker ps --format '{{.Names}}'"
```

The IP can change when the stack is recreated — run this again after a deploy.

## 2. Read the credentials

```bash
ssh USER@VPS "grep '^POSTGRES_' /opt/clinic/sandbox/.env"
```

This gives `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB`. Never commit them.

## 3. Open the tunnel

In its own terminal, left running:

```bash
ssh -N -L 5433:172.18.0.2:5432 USER@VPS
```

Use the IP from step 1. Port 5433 locally, so it cannot collide with a Postgres on your machine.
`Ctrl+C` closes it.

## 4. Connect

```
postgres://POSTGRES_USER:POSTGRES_PASSWORD@localhost:5433/POSTGRES_DB
```

## Running the API tests

**Never point the tests at the sandbox database.** The test setup applies migrations and creates
clinics and users. Use a scratch database on the same server instead — once:

```bash
ssh USER@VPS "docker exec clinic-sandbox-postgres-1 createdb -U POSTGRES_USER clinic_test"
```

Then, with the tunnel open:

```bash
cd apps/api
DATABASE_URL=postgres://POSTGRES_USER:POSTGRES_PASSWORD@localhost:5433/clinic_test pnpm test
```

Pass a pattern to run part of the suite, e.g. `pnpm test ai-` for the assistant specs.
