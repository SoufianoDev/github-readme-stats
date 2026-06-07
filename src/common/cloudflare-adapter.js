// @ts-check

/**
 * @file Compatibility adapter for running Vercel-style (req, res) handlers
 * on Cloudflare Workers / Pages Functions.
 *
 * The adapter wraps a Cloudflare Pages `EventContext` into Express-like
 * `req` and `res` objects so that existing API handlers can run unchanged.
 *
 * It also rebinds `process.env` to a Proxy that reads from a request-scoped
 * store populated with `context.env` on every request. This is necessary
 * because:
 *   - With `nodejs_compat`, the runtime provides a `process` global whose
 *     `env` is empty and not linked to Pages environment variables.
 *   - Modules are evaluated once at cold start, before any request arrives,
 *     so we cannot rely on mutating `process.env` at import time.
 *   - Overwriting `globalThis.process` directly is unreliable across
 *     runtimes, so we use a Proxy installed via `Object.defineProperty`.
 */

// Request-scoped store for environment variables. Populated in
// `adaptRequest` from `context.env` and read through the `envProxy` below.
let currentEnv = {};

/**
 * A Proxy that exposes `currentEnv` as a plain object. `Object.keys(env)`,
 * `key in env`, and `env.KEY` all reflect the latest `currentEnv`.
 *
 * @type {Record<string, string>}
 */
const envProxy = new Proxy(currentEnv, {
  get(_target, key) {
    return currentEnv[key];
  },
  set(_target, key, value) {
    currentEnv[key] = value;
    return true;
  },
  deleteProperty(_target, key) {
    return delete currentEnv[key];
  },
  has(_target, key) {
    return key in currentEnv;
  },
  ownKeys() {
    return Reflect.ownKeys(currentEnv);
  },
  getOwnPropertyDescriptor(_target, key) {
    if (key in currentEnv) {
      return {
        enumerable: true,
        configurable: true,
        value: currentEnv[key],
        writable: true,
      };
    }
    return undefined;
  },
});

// Install our Proxy as `process.env` (or install a minimal `process` if
// the runtime does not provide one). This works regardless of whether
// the runtime already defined `process` — `Object.defineProperty` with
// `configurable: true` replaces the existing descriptor.
try {
  // @ts-ignore - partial polyfill, only env + versions are needed
  Object.defineProperty(globalThis, "process", {
    value: {
      env: envProxy,
      versions: { node: "20.0.0" },
    },
    writable: true,
    configurable: true,
  });
} catch (_) {
  // If defineProperty is blocked, fall back to direct assignment.
  // @ts-ignore
  globalThis.process = { env: envProxy, versions: { node: "20.0.0" } };
}

/**
 * Runs a Vercel-style handler `(req, res) => ...` inside a Cloudflare Pages
 * Function context and returns a proper `Response`.
 *
 * @param {Object} context - The Cloudflare Pages Function context.
 * @param {Request} context.request - The incoming request.
 * @param {Record<string, string>} context.env - Environment variables (bound as Workers env).
 * @param {Function} handler - The Vercel-style handler `(req, res) => any`.
 * @returns {Promise<Response>} The Cloudflare Workers Response.
 */
export async function adaptRequest(context, handler) {
  // Replace the request-scoped env store so the Proxy returns the
  // current request's environment variables.
  currentEnv = { ...(context.env || {}) };

  const url = new URL(context.request.url);

  // Build a Vercel/Express-like `req` object.
  const req = {
    method: context.request.method,
    url: context.request.url,
    query: Object.fromEntries(url.searchParams.entries()),
    headers: Object.fromEntries(context.request.headers.entries()),
  };

  // Collect response state.
  let responseBody = "";
  const responseHeaders = new Headers();

  // Build a Vercel/Express-like `res` object.
  const res = {
    /**
     * Set a response header.
     *
     * @param {string} name  Header name.
     * @param {string} value Header value.
     */
    setHeader(name, value) {
      responseHeaders.set(name, String(value));
    },

    /**
     * Send the response body. Mirrors Express `res.send` semantics:
     * the body is stored and the value is returned so that callers that
     * write `return res.send(body)` work correctly.
     *
     * @param {string} body The response body.
     * @returns {string} The body that was sent.
     */
    send(body) {
      responseBody = body ?? "";
      return responseBody;
    },
  };

  // Run the original Vercel-style handler.
  await handler(req, res);

  // Default to SVG content type when none was explicitly set.
  if (!responseHeaders.has("Content-Type")) {
    responseHeaders.set("Content-Type", "image/svg+xml");
  }

  return new Response(responseBody, {
    status: 200,
    headers: responseHeaders,
  });
}
