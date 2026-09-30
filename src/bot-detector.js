// Pre-compiled regex matching known AI bots, search engines, crawlers, and scrapers
const BOT_REGEX = new RegExp(
  [
    // AI Crawlers & Scrapers
    "gptbot",
    "chatgpt-user",
    "oai-searchbot",
    "claudebot",
    "claude-web",
    "anthropic-ai",
    "google-extended",
    "perplexitybot",
    "bytespider",
    "ccbot",
    "facebookbot",
    "meta-externalagent",
    "meta-externalfetcher",
    "applebot-extended",
    "cohere-ai",
    "amazonbot",
    "diffbot",
    "omgilibot",
    "imagesiftbot",
    "youbot",
    "timpibot",
    "mistralai",

    // Search Engine Crawlers
    "googlebot",
    "bingbot",
    "msnbot",
    "bingpreview",
    "adidxbot",
    "slurp",
    "duckduckbot",
    "baiduspider",
    "yandexbot",
    "yandexmobilebot",
    "sogou",
    "exabot",
    "seznambot",
    "yeti",
    "applebot",
    "petalbot",
    "qwantify",

    // SEO & Archiving Crawlers
    "ahrefsbot",
    "semrushbot",
    "dotbot",
    "mj12bot",
    "rogerbot",
    "ia_archiver",
    "archive\\.org_bot",
    "dataforseobot",
    "screaming frog",

    // Generic bot/crawler word patterns and crawler attribution URLs
    "\\b(?:bot|crawler|spider|scraper)\\b",
    "\\+https?:\\/\\/"
  ].join("|"),
  "i"
)

/**
 * Checks whether the incoming request hostname corresponds to the test environment.
 * @param {string} hostname
 * @param {string} [configuredTestHostname]
 * @returns {boolean}
 */
export function isTestSite(hostname, configuredTestHostname) {
  const host = (hostname || "").toLowerCase().split(":")[0]
  if (configuredTestHostname && host === configuredTestHostname.toLowerCase().trim()) {
    return true
  }
  return host === "proxy.someecards.com"
}

/**
 * Checks whether the request has a valid bypass header.
 * Header: X-Bypass-Bot-Check
 * If BOT_BYPASS_SECRET is set in environment, requires exact match.
 * If BOT_BYPASS_SECRET is not set, allows "true" or "1".
 * @param {Request} request
 * @param {object} [env]
 * @returns {boolean}
 */
export function shouldBypassBotCheck(request, env) {
  const bypassHeader = request.headers.get("x-bypass-bot-check")
  if (!bypassHeader) {
    return false
  }

  const secret = env?.BOT_BYPASS_SECRET
  if (secret) {
    return bypassHeader === secret
  }

  const val = bypassHeader.toLowerCase().trim()
  return val === "true" || val === "1"
}

/**
 * Checks whether a request originated from a bot, crawler, or AI scraper.
 * Empty or missing User-Agent is treated as a normal user.
 * @param {Request} request
 * @returns {{ isBot: boolean, reason?: string }}
 */
export function detectBot(request) {
  // 1. Cloudflare native bot signals
  if (request.cf?.isBot) {
    return { isBot: true, reason: "cf_is_bot" }
  }
  if (request.cf?.verifiedBot || request.cf?.botManagement?.verifiedBot) {
    return { isBot: true, reason: "cf_verified_bot" }
  }
  if (request.headers.get("cf-verified-bot") === "true") {
    return { isBot: true, reason: "cf_header_verified_bot" }
  }

  // 2. User-Agent inspection (Empty User-Agent acts as normal user)
  const ua = request.headers.get("user-agent")
  if (!ua || !ua.trim()) {
    return { isBot: false }
  }

  const match = BOT_REGEX.exec(ua)
  if (match) {
    return { isBot: true, reason: `bot_pattern_${match[0].toLowerCase()}` }
  }

  return { isBot: false }
}
