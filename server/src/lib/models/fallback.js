// One failover hop, only before the first nonempty text token.
const configuredTimeout = Number(process.env.MODEL_FIRST_TOKEN_TIMEOUT_MS || 20000);
export const FIRST_TOKEN_TIMEOUT_MS = Number.isFinite(configuredTimeout) && configuredTimeout > 0
  ? configuredTimeout : 20000;

export function isRetryableError(error) {
  const message = typeof error === "string" ? error : error?.message || "";
  const status = Number(error?.status || message.match(/\b([45]\d\d)\b/)?.[1]);
  // Explicit HTTP errors take precedence over misleading words in their bodies.
  if (status) return status === 404 || status === 429 || (status >= 500 && status <= 599);
  if (/auth|api.?key|unauthorized|forbidden|bad.?request|invalid.?request|guardrail/i.test(message)) return false;
  return /overloaded|rate.?limit|timeout|timed.?out|network|fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|not.?found|no such model/i.test(message);
}

export function createCompletionStreamer(streamRoute, timeoutMs = FIRST_TOKEN_TIMEOUT_MS) {
  return async function* streamCompletion(params) {
    const primary = params.spec?.payload?.modelRouting?.primary;
    const fallback = params.spec?.payload?.modelRouting?.fallback;
    if (typeof fallback !== "string" || !fallback || fallback === primary) {
      yield* streamRoute({ ...params, route: primary });
      return;
    }
    const controller = new AbortController();
    const iterator = streamRoute({ ...params, route: primary, signal: controller.signal })[Symbol.asyncIterator]();
    let timer;
    let hasToken = false;
    const buffered = [];
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout: no first token")), timeoutMs);
    });
    let failure;
    try {
      while (true) {
        let next;
        try {
          next = await (hasToken ? iterator.next() : Promise.race([iterator.next(), deadline]));
        } catch (error) {
          next = { value: { type: "error", message: error?.message || String(error), status: error?.status } };
        }
        if (next.done) {
          for (const event of buffered) yield event;
          return;
        }
        const event = next.value;
        if (!hasToken && event?.type === "error" && isRetryableError(event)) {
          failure = event;
          break;
        }
        if (event?.type === "token" && event.text?.length) {
          hasToken = true;
          clearTimeout(timer);
          for (const pending of buffered.splice(0)) yield pending;
        }
        if (hasToken || event?.type === "done" || event?.type === "error") {
          if (!hasToken) for (const pending of buffered.splice(0)) yield pending;
          yield event;
        } else buffered.push(event);
        if (event?.type === "error" || event?.type === "done") return;
      }
    } finally {
      clearTimeout(timer);
      controller.abort();
      // Abort the provider before requesting generator cleanup; a pending next()
      // may otherwise keep the old request alive throughout the fallback.
      Promise.resolve(iterator.return?.()).catch(() => {});
    }
    if (failure) {
      console.warn(`[router] primary ${primary} failed; falling back to ${fallback}`);
      const telemetry = { ...params.telemetry, fallbackFrom: primary };
      for await (const event of streamRoute({ ...params, route: fallback, telemetry })) {
        yield event?.type === "done"
          ? { ...event, usage: { ...event.usage, fallback_from: primary } }
          : event;
      }
    }
  };
}
