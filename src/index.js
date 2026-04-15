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

    // 👇 clone BEFORE passing further
    const primaryClone = env.PRIMARY_BODY_DEBUG && primaryRes.status >= 500 ? primaryRes.clone() : null

    ctx.waitUntil(
      handleMirror(request, primaryRes, primaryClone, primaryDuration, secondaryReq, env.PRIMARY_BODY_DEBUG)
    )

    return primaryRes
  }
}

function shouldMirror(pathname) {
  // Bot sites may generate unique Next.js asset filenames, so ignore this folder.
  return !pathname.startsWith("/_next/") && !pathname.startsWith("/favicons/") && !pathname.startsWith("/.well-known/")
}

async function handleMirror(originalRequest, primaryRes, primaryClone, primaryDuration, secondaryReq, isDebugBody) {
  const secondaryStart = Date.now()

  try {
    const secondaryRes = await fetch(secondaryReq)
    const secondaryDuration = Date.now() - secondaryStart
    const delta = secondaryDuration - primaryDuration
    const isSecondaryStatusForLogging = secondaryRes.status != 404 && secondaryRes.status != 304 && secondaryRes.status != 308 

    if (Math.abs(delta) > 200 && primaryRes.status !== secondaryRes.status) {
      log({
        type: "secondary_slower",
        url: originalRequest.url,
        method: originalRequest.method,
        primary_duration_ms: primaryDuration,
        secondary_duration_ms: secondaryDuration,
        primary_status: primaryRes.status,
        secondary_status: secondaryRes.status,
        delta_ms: delta
      })
    }

    if (!secondaryRes.ok && isSecondaryStatusForLogging) {
      let secondaryBodyPreview = null
      if (isDebugBody && secondaryRes.status >= 500) {
        secondaryBodyPreview = await getBodyPreview(secondaryRes)
      }
      log({
        type: "secondary_error",
        primary_status: primaryRes.status,
        secondary_status: secondaryRes.status,
        url: originalRequest.url,
        secondary_body_preview: secondaryBodyPreview,
      })
    }

    // Only investigate when there is a problem
    if (primaryRes.status > 500 || primaryRes.status !== secondaryRes.status) {

      let primaryBodyPreview = null

      if (primaryClone) {
        primaryBodyPreview = await getBodyPreview(primaryClone)
      }

      log({
        type: "status_mismatch",
        url: originalRequest.url,
        primary_status: primaryRes.status,
        secondary_status: secondaryRes.status,
        primary_body_preview: primaryBodyPreview,
      })
    }

  } catch (err) {
    log({
      type: "general_error",
      primary_status: primaryRes.status,
      url: originalRequest.url,
      err: {
        message: err.message,
        stack: err.stack
      }
    })
  }
}

async function getBodyPreview(response) {
  try {
    const text = await response.text()
    return text.slice(0, 1000) // limit size
  } catch (e) {
    return "failed_to_read_body"
  }
}

function log(data) {
  const base = {
    source: "worker-proxy",
    timestamp: new Date().toISOString(),
    ...data
  }

  // Route logs by severity
  if (
    data.type === "secondary_error" ||
    data.type === "secondary_failure" ||
    data.type === "status_mismatch"
  ) {
    console.error(JSON.stringify(base))   // real errors
  } else if (data.type === "secondary_slower") {
    console.warn(JSON.stringify(base))    // warnings
  } else {
    console.log(JSON.stringify(base))     // normal info
  }
}