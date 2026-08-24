import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.ts',
    screens: 'src/screens.ts',
    devtools: 'src/devtools.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  // Re-export rather than re-bundle, so installing both `dualscreen` and a
  // scoped package cannot produce two copies of the protocol in one app.
  external: ['react', '@dualscreen/core', '@dualscreen/screens', '@dualscreen/react', '@dualscreen/devtools'],
})
