import nextConfig from 'eslint-config-next';
import prettierConfig from 'eslint-config-prettier';

// Extract the @typescript-eslint plugin from eslint-config-next
const tsPlugin = nextConfig.find(
  (c) => c.plugins?.['@typescript-eslint'],
)?.plugins?.['@typescript-eslint'];

const eslintConfig = [
  ...nextConfig,
  prettierConfig,
  {
    plugins: {
      ...(tsPlugin ? { '@typescript-eslint': tsPlugin } : {}),
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    ignores: ['.next/', 'node_modules/', 'supabase/functions/', '.aios-core/'],
  },
];

export default eslintConfig;
