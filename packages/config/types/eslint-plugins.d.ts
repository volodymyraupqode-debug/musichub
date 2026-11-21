// Minimal typings for ESLint plugins that ship no type declarations.
declare module 'eslint-plugin-jsx-a11y' {
  import type { ESLint, Linter } from 'eslint';

  const plugin: ESLint.Plugin & { flatConfigs: Record<'recommended' | 'strict', Linter.Config> };
  export default plugin;
}
