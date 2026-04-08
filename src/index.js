export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    const PRIMARY = env.PRIMARY_URL
    const SECONDARY = env.SECONDARY_URL

    const primaryReq = new Request(PRIMARY + url.pathname + url.search, request)
    const secondaryReq = new Request(SECONDARY + url.pathname + url.search, request)

    // Measure primary latency before optionally mirroring the request.
    const primaryStart = Date.now()
    const primaryRes = await fetch(primaryReq)
    const primaryDuration = Date.now() - primaryStart

    if (!shouldMirror(url.pathname)) {
      return primaryRes
    }

    ctx.waitUntil(handleMirror(request, primaryRes, primaryDuration, secondaryReq))

    return primaryRes
  }
}

function shouldMirror(pathname) {
  // Bot sites may generate unique Next.js asset filenames, so ignore this folder.
  return !pathname.startsWith("/_next/static/")
}

async function handleMirror(originalRequest, primaryRes, primaryDuration, secondaryReq) {
  const secondaryStart = Date.now()

  try {
    const secondaryRes = await fetch(secondaryReq)
    const secondaryDuration = Date.now() - secondaryStart
    const delta = secondaryDuration - primaryDuration

    log({
      type: "timing_comparison",
      url: originalRequest.url,
      method: originalRequest.method,
      primary_duration_ms: primaryDuration,
      secondary_duration_ms: secondaryDuration,
      delta_ms: delta
    })

    if (delta > 300) {
      log({
        type: "secondary_slower",
        url: originalRequest.url,
        method: originalRequest.method,
        delta_ms: delta
      })
    }

    if (!secondaryRes.ok) {
      log({
        type: "secondary_error",
        status: secondaryRes.status,
        url: originalRequest.url
      })
    }

    if (primaryRes.status !== secondaryRes.status) {
      log({
        type: "status_mismatch",
        url: originalRequest.url,
        primary_status: primaryRes.status,
        secondary_status: secondaryRes.status
      })
    }

  } catch (err) {
    log({
      type: "secondary_failure",
      url: originalRequest.url,
      error: err.message
    })
  }
}

function log(data) {
  console.error(JSON.stringify({
    source: "worker-proxy",
    timestamp: new Date().toISOString(),
    ...data
  }))
}