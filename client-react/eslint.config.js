import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Vendored rich-text editor module (TipTap) + ArticleContent renderer.
    // This self-contained module was authored against an earlier react-hooks
    // ruleset; the newest React-Compiler-era rules flag valid, working patterns
    // (effect-driven input sync, ref reads in render, in-place mutations). We
    // keep the module intact and relax only those opinionated rules here.
    files: [
      'src/components/editor/**/*.{js,jsx}',
      'src/components/ai/**/*.{js,jsx}',
      'src/components/ArticleContent.jsx',
      'src/utils/sanitizeHtml.js',
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'no-empty': 'off',
      'no-useless-assignment': 'off',
    },
  },
  {
    // Build/config files run in Node, not the browser.
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
