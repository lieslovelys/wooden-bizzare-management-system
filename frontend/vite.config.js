import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  base: '/', // <--- IDINAGDAG ITO: Sinisiguro nito na tama ang pathing ng assets mo sa Render

  // P1-11: Vitest reuses this Vite config directly (same plugins/resolve), rather than a
  // separate vitest.config.js, per Vitest's recommended setup for Vite projects.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.js',
    // ARCHITECTURE_REVIEW.md item 32: the shop's business day is Asia/Manila (UTC+8), and
    // utils/format.test.js's toDateInputValue regression test depends on running in that zone —
    // it only reproduced on a UTC CI runner, never on a UTC+8 dev machine, which is how it stayed
    // green locally for three phases while failing in CI. Pin it here so both agree.
    env: { TZ: 'Asia/Manila' },
  },
})
