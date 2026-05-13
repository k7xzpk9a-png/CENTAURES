import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// BASE_PATH is set by tools/deploy_pages.sh when building for GitHub Pages
// (e.g. "/CENTAURES"). It must NOT have a trailing slash. Empty for local dev
// + preview so `npm run dev` keeps serving at /.
const BASE_PATH = process.env.BASE_PATH ?? '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    paths: {
      base: BASE_PATH,
    },
    // SPA mode: everything renders client-side; unknown routes fall back to
    // index.html so the client router can handle them. Deploy script also
    // copies index.html → 404.html so GH Pages serves the SPA shell on
    // direct hits to sub-routes (e.g. /m/<id>/configuration).
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false,
      strict: true,
    }),
  },
};

export default config;
