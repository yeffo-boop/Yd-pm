# YeffoHub — Deployment

Status: written ahead of schedule (originally slated for Phase 8) at the
owner's request, to get the Phase 1 build onto the real VPS for private,
owner-only testing before Phase 2 begins. Scoped to what Phase 1 actually
needs: no SMTP, no GCS, no reverse-proxy-managed TLS (Apache already
handles that here). Phase 8 expands this with automated backups,
monitoring, log rotation, and a zero-downtime deploy procedure.

This walkthrough assumes the concrete setup confirmed with the owner:

- VPS: Debian, Docker not yet installed
- Domain: `hub.yeffodesign.com`, DNS already pointed at this VPS
- Apache already runs on ports 80/443 for other sites on this VPS, with a
  vhost for `hub.yeffodesign.com` already created and already serving
  valid HTTPS (certificate already issued)
- The GitHub repository is already cloned on the server

## 1. Install Docker Engine + Compose plugin (Debian)

Commands can vary by distribution — this is Debian's official Docker
install path ([docs.docker.com](https://docs.docker.com/engine/install/debian/)).
Run as a user with sudo:

```bash
# Remove any conflicting older packages, if present
sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Set up Docker's apt repository
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Let your deploy user run docker without sudo (log out/in after this)
sudo usermod -aG docker "$USER"
```

Verify:

```bash
docker --version
docker compose version
```

## 2. Get the app onto the server

```bash
cd /path/to/your/clone   # wherever the repo is already cloned
git fetch origin
git checkout claude/yeffohub-mvp-spec-2valol
git pull
```

(Once this branch is merged, switch to tracking `main` instead — same
commands, different branch name.)

## 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set **real, unique** values — never the example/dev
placeholders — for:

```bash
# Generate each of these independently:
openssl rand -base64 32   # -> AUTH_SECRET
openssl rand -base64 32   # -> ENCRYPTION_MASTER_KEY
openssl rand -base64 24   # -> POSTGRES_PASSWORD
```

```bash
APP_BASE_URL=https://hub.yeffodesign.com
DATABASE_URL=postgresql://yeffohub:<the POSTGRES_PASSWORD you generated>@db:5432/yeffohub
AUTH_SECRET=<generated>
ENCRYPTION_MASTER_KEY=<generated>
POSTGRES_USER=yeffohub
POSTGRES_PASSWORD=<generated>
POSTGRES_DB=yeffohub
```

Leave `OWNER_BOOTSTRAP_EMAIL` / `OWNER_BOOTSTRAP_PASSWORD` **blank** in
`.env` — those are passed as one-time command-line values in step 6, not
stored in the file (see `scripts/bootstrap-owner.ts`).

`.env` contains real secrets from this point on — confirm it's not
tracked by git (`git status` should not show it; `.gitignore` already
excludes it) and restrict its permissions:

```bash
chmod 600 .env
```

## 4. Build and start the database

```bash
docker compose build
docker compose up -d db
docker compose ps   # wait for db to report "healthy"
```

## 5. Apply the database schema

```bash
docker compose run --rm migrate
```

## 6. Create your real OWNER account

Do **not** run `npm run seed` / the seed script on this server — it
creates fictional demo accounts sharing one known dev-only password,
which is fine for local development and CI but not for anything reachable
from the internet, even privately. Instead:

```bash
docker compose run --rm \
  -e OWNER_BOOTSTRAP_EMAIL="you@yeffodesign.com" \
  -e OWNER_BOOTSTRAP_PASSWORD="a long, unique, real password" \
  migrate npx tsx scripts/bootstrap-owner.ts
```

(Reuses the `migrate` service's image — it already has the full source
and dependencies needed to run the script; only the command differs.) The
script refuses to run if an OWNER already exists, so this is safe to
re-run if it fails partway.

## 7. Start the app and worker

```bash
docker compose up -d app worker
docker compose ps
curl -s http://127.0.0.1:3000/api/health
curl -s http://127.0.0.1:3000/api/ready
```

Both health checks should return `{"status":"ok"}`. The app is now
listening on `127.0.0.1:3000` only — not yet reachable from the internet
until Apache is pointed at it (next step).

## 8. Point the existing Apache vhost at the app

You said `hub.yeffodesign.com` already has a working Apache vhost with
HTTPS. Edit that vhost's config (commonly
`/etc/apache2/sites-available/hub.yeffodesign.com.conf` or
`hub.yeffodesign.com-le-ssl.conf` if Certbot manages it) and replace its
document-root/static-file directives with a reverse proxy to the app
container. First, enable the required Apache modules:

```bash
sudo a2enmod proxy proxy_http headers
```

Inside the **HTTPS** (`<VirtualHost *:443>`) block for
`hub.yeffodesign.com`, add:

```apache
<VirtualHost *:443>
    ServerName hub.yeffodesign.com

    # ... existing SSLEngine/SSLCertificateFile/SSLCertificateKeyFile
    # directives from Certbot stay as-is — only the proxying part below
    # is new/changed.

    ProxyPreserveHost On
    ProxyPass /.well-known/acme-challenge/ !
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/

    # Required: without this, the app can't tell the original request was
    # HTTPS, which breaks Auth.js's secure-cookie handling and any
    # https-only logic. mod_proxy_http adds X-Forwarded-For/-Host/-Server
    # automatically, but NOT X-Forwarded-Proto — that one has to be set
    # explicitly.
    RequestHeader set X-Forwarded-Proto "https"
</VirtualHost>
```

The `ProxyPass /.well-known/acme-challenge/ !` line excludes Certbot's
renewal path from the proxy if this vhost is Certbot-managed — remove it
only if you're certain nothing else needs it.

Test the config and reload:

```bash
sudo apache2ctl configtest
sudo systemctl reload apache2
```

Visit `https://hub.yeffodesign.com/login` — you should see the YeffoHub
sign-in page. Sign in with the OWNER account you created in step 6.

## 9. Confirm it's actually private

Nothing in Phase 1 creates a public sign-up path — the only way to get an
account is the bootstrap script (step 6) or, later, an owner-issued
invitation (Phase 2). Confirm:

- `curl -s http://<vps-public-ip>:3000` from **outside** the VPS should
  fail to connect (the app only listens on `127.0.0.1`, not the public
  interface) — if your VPS has a firewall (`ufw`/`nvps-provider
  firewall), port 3000 shouldn't need an explicit rule either way, since
  it was never bound to a public interface.
- `https://hub.yeffodesign.com/owner` while logged out redirects to
  `/login`, not to a dashboard.

## Redeploying after a code change

```bash
git pull
docker compose build
docker compose run --rm migrate   # applies any new migrations
docker compose up -d app worker   # recreates containers with the new image
```

This is a brief-downtime redeploy (the old `app` container stops before
the new one is ready) — acceptable for private single-user testing.
Phase 8 documents a lower-downtime approach for real production use.

## What's intentionally not here yet

Automated backups, log rotation, monitoring/alerting, and a documented
restore/rollback procedure are Phase 8 work — the master spec assigns
them there, and standing them up before there's any real client data to
protect would be premature. Until then, treat this deployment as
uncommitted-state test infrastructure: don't put anything into it (client
data, real projects) that you couldn't afford to lose to a database reset
during Phase 2–7 development, and don't invite a real client contact into
it before Phase 8's backup story exists.
