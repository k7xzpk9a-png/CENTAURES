// Per-mission routes are dynamic (id created at runtime, not enumerable at
// build time), so we opt out of prerender here. adapter-static emits
// index.html as the SPA fallback (svelte.config.js → fallback: 'index.html'),
// which the client router uses to resolve /m/<id>/* on demand.
//
// ssr=false is inherited from the root layout.
export const prerender = false;
