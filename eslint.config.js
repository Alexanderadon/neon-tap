import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import boundaries from 'eslint-plugin-boundaries';

const LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', 'assets-src', 'scripts', '.tmp'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022 },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh, boundaries },
    settings: {
      'boundaries/elements': LAYERS.map((layer) => ({
        type: layer,
        pattern: `src/${layer}/*`,
        mode: 'folder',
        capture: ['slice'],
      })),
      'boundaries/ignore': ['**/*.test.ts'],
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Feature-Sliced Design: a layer may import only from layers below it.
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'app', allow: ['pages', 'widgets', 'features', 'entities', 'shared'] },
            { from: 'pages', allow: ['widgets', 'features', 'entities', 'shared'] },
            { from: 'widgets', allow: ['features', 'entities', 'shared'] },
            { from: 'features', allow: ['entities', 'shared'] },
            { from: 'entities', allow: ['shared'] },
            { from: 'shared', allow: ['shared'] },
          ],
        },
      ],
    },
  },
);
