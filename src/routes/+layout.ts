// SPA mode: render only on the client. The password gate touches localStorage
// which is undefined at prerender / SSR time, and the rest of the app is
// equally client-driven (mission state in localStorage, perf calc in browser).
//
// prerender=false leaves the single SPA fallback (build/index.html via
// adapter-static) as the only HTML artifact, served for every URL. The
// client router then routes to the correct page.
export const ssr = false;
export const prerender = false;
