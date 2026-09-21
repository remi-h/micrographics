import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

// Flat config (`eslint.config.mjs`) is what Next 16 documents — see
// node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md.
// `next lint` was removed in Next 16, so linting runs through the ESLint CLI.
// `eslint-config-prettier` goes last so Prettier owns formatting and ESLint
// owns correctness; the two never disagree about the same line.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Re-declares eslint-config-next's default ignores, which are dropped as
  // soon as this config sets its own, plus this repo's test/build output.
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
  ]),
]);

export default eslintConfig;
