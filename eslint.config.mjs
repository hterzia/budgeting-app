import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Root flat config covering both workspaces (frontend React/TS + backend Node/TS)
// plus the CommonJS build scripts. Non-type-aware on purpose: fast, and doesn't
// depend on per-package tsconfig project resolution — `npm run type-check`
// already enforces full type correctness.
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/coverage/**',
      'models/**',
      'electron/dist/**',
      '**/*.config.{js,cjs,mjs,ts}',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // TypeScript source: frontend (browser) + backend/e2e (node)
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  // Plain JS / ESM helper scripts
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  // CommonJS build scripts (.cjs): require()/module are expected
  {
    files: ['**/*.cjs'],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  // Unused variables are a warning (not a hard failure) across the whole tree;
  // names prefixed with _ are intentionally ignored.
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
);
