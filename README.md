# Worker Proxy (Shadow Traffic)

## Setup

```shell
npm install
```

## Local dev
In root folder of the project run:

```shell
docker compose up --build
```

The local container uses a Debian-based Node 20 image with `ca-certificates`
installed because Cloudflare's `workerd` binary does not run on Alpine/musl,
and Wrangler local dev is more reliable there than on Node 22.

If you previously ran the Alpine container, reset the old container volume first:

```shell
docker compose down -v
docker compose up --build
```

The container fixes ownership on the mounted `node_modules` volume before
starting the app as the non-root `node` user.

For manual run use:

```shell
npm install
npm run dev
```

## Deploy
npm run deploy

## Env vars

Set in wrangler.toml or Cloudflare dashboard:

- PRIMARY_URL
- SECONDARY_URL
