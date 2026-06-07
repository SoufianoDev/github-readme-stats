// @ts-check

/**
 * @file Compatibility adapter for running Vercel-style (req, res) handlers
 * on Cloudflare Workers / Pages Functions.
 *
 * The adapter wraps a Cloudflare Workers `EventContext` into Express-like
 * `req` and `res` objects so that existing API handlers can run unchanged.
 */

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
  // Polyfill process.env from the Cloudflare env binding so that modules
  // which read process.env at import time (e.g. src/common/envs.js,
  // src/common/cache.js) see the correct values.
  if (typeof globalThis.process === "undefined") {
    globalThis.process = { env: {} };
  } else if (!globalThis.process.env) {
    globalThis.process.env = {};
  }
  Object.assign(globalThis.process.env, context.env);

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
