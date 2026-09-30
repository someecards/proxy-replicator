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

- `PRIMARY_URL`: Primary origin URL.
- `SECONDARY_URL`: Secondary origin URL for mirroring.
- `PRIMARY_BODY_DEBUG`: Flag (true/false) to enable capturing error response bodies in logs.
- `TEST_HOSTNAME`: Hostname for the test environment (defaults to `proxy.someecards.com`).
- `BOT_BYPASS_SECRET`: (Optional) Secret required in the `X-Bypass-Bot-Check` header. If unset, any value like `true` or `1` bypasses bot checks.

## Bot & Crawler Blocking on Testing Domain

The worker automatically protects the testing domain (`proxy.someecards.com` / `TEST_HOSTNAME`):
- **`/robots.txt`**: Automatically returns `User-agent: *\nDisallow: /` with 200 OK.
- **Bot & Crawler Blocking**: All requests matching known AI scrapers (e.g. GPTBot, ClaudeBot, Google-Extended, PerplexityBot, Bytespider), search engines (Googlebot, Bingbot, YandexBot, etc.), or generic crawlers are rejected with `403 Forbidden`.
- **Empty User-Agent**: Treated as a normal human user (allowed).
- **Bypass Header**: Send `X-Bypass-Bot-Check: true` (or matching `BOT_BYPASS_SECRET` if configured) to bypass bot blocking for synthetic monitoring or automated testing.
- **`X-Robots-Tag`**: Every response returned on the testing domain automatically includes `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`.
- **Live Domain (`www.someecards.com`)**: Completely unaffected with zero bot blocking or overhead.

