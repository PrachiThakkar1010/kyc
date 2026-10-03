// @ts-check
import { defineConfig, envField } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  // Every page is built when it is requested, so new stories appear instantly.
  output: 'server',
  // We serve photos straight from Supabase and don't use Astro sessions,
  // so no extra Cloudflare services (Images, KV) are needed.
  adapter: cloudflare({ imageService: 'passthrough' }),
  session: false,

  // Secret settings. Locally they live in .dev.vars; on Cloudflare in the
  // Worker's "Variables and Secrets". They are never sent to browsers.
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: 'server', access: 'secret' }),
      SUPABASE_PUBLISHABLE_KEY: envField.string({ context: 'server', access: 'secret' }),
      SUPABASE_SECRET_KEY: envField.string({ context: 'server', access: 'secret' }),
      TURNSTILE_SITE_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      TURNSTILE_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
