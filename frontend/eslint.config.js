import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // ARCHITECTURE_REVIEW.md item 30: the same kind of regression guard `no-alert` (item 26)
      // is for native dialogs — a missing label, an unlabeled icon button, or a removed-with-
      // nothing-put-back focus outline now fails CI instead of depending on review to catch it.
      jsxA11y.flatConfigs.recommended,
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
      // ARCHITECTURE_REVIEW.md item 26: native dialogs are replaced app-wide by
      // globals/ConfirmModal.jsx (confirm) and useToast() (alert) — this stops one from
      // coming back.
      'no-alert': 'error',
    },
  },
])
