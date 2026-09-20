import { execFileSync } from 'node:child_process';
import path from 'path';
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import svgr from 'vite-plugin-svgr';
import packageJson from './package.json';

const commit =
  process.env.BUILD_COMMIT ||
  execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: __dirname,
    encoding: 'utf8',
  }).trim();
const assetsDir = `assets/${commit}`;

export default defineConfig({
  esbuild: false,
  build: {
    // Sourcemaps existed to make Sentry stack traces readable. With Sentry
    // gone they are ~13MB of dead weight stored permanently on Arweave with
    // every deploy, so they are no longer emitted.
    sourcemap: false,
    minify: true,
    cssMinify: true,
    assetsDir,
    // Automatic CommonJS wrapping can race and change otherwise identical builds.
    commonjsOptions: { strictRequires: true },
    rollupOptions: {
      output: {
        entryFileNames: `${assetsDir}/[name].js`,
        chunkFileNames: (chunk) => {
          const name = chunk.facadeModuleId
            ? path
                .relative(__dirname, chunk.facadeModuleId)
                .replaceAll('\\', '/')
                .replace(/\.[^/.]+$/, '')
            : chunk.name;
          return `${assetsDir}/chunks/${name}.js`;
        },
        assetFileNames: `${assetsDir}/[name][extname]`,
        manualChunks: (id) => {
          const moduleId = id.replaceAll('\\', '/');
          if (moduleId.endsWith('/src/version.ts')) return 'version';
          // Keep shared helpers below their consumers to avoid initialization cycles.
          if (moduleId === '\0commonjsHelpers.js') return 'vendor-utils';
          const dependency = moduleId.split('/node_modules/').at(-1);
          if (dependency === moduleId || !dependency) return;
          if (
            /^(react[^/]*|scheduler|zustand|lucide-react|recharts[^/]*|better-react-mathjax|markdown-to-jsx|dexie-react-hooks|use-sync-external-store|use-callback-ref|use-sidecar|@(?:tanstack|radix-ui|headlessui|react-aria|react-stately|floating-ui)\/[^/]+)\//.test(
              dependency,
            )
          ) {
            return 'vendor-ui';
          }
          if (
            /^(@solana(?:-mobile|-program)?\/[^/]+|@metaplex-foundation\/[^/]+|@coral-xyz\/[^/]+)\//.test(
              dependency,
            )
          ) {
            return 'vendor-solana';
          }
          if (
            /^(@ar\.io\/[^/]+|arweave|arbundles|@dha-team\/[^/]+)\//.test(
              dependency,
            )
          ) {
            return 'vendor-ario';
          }
          return 'vendor-utils';
        },
      },
    },
  },
  plugins: [svgr(), react(), nodePolyfills()],
  base: '',
  define: {
    __NPM_PACKAGE_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_COMMIT__: JSON.stringify(commit),
    'process.env': {
      // DO NOT EXPOSE THE ENTIRE process.env HERE - sensitive information on CI/CD could be exposed.
      // defining here as an empty object as there are errors otherwise
    },
    'process.version': `"${process.version}"`,
  },
  resolve: {
    alias: {
      '@tests': path.resolve(__dirname) + '/tests',
      '@src': path.resolve(__dirname) + '/src',
    },
  },
});
