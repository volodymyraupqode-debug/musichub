// Package boundary rules from ARCHITECTURE.md §3.1. Run: `pnpm depcruise`.
// Packages that do not exist yet are covered so the rules apply as soon as they are created.
const PURE = '^packages/(music-model|editor-core|practice-core|midi-engine|piano-visualizer)/';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'not-to-unresolvable',
      comment:
        'Imports must resolve: an undeclared dependency (e.g. react in a pure package) fails here.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true, pathNot: '^(node:|next-env)' },
    },
    {
      name: 'no-app-to-app',
      comment: 'Apps never import each other.',
      severity: 'error',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/', pathNot: '^apps/$1/' },
    },
    {
      name: 'no-package-to-app',
      comment: 'Packages never import apps.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'alphatab-only-in-music-engine',
      comment:
        'Only packages/music-engine may import alphaTab (AGENT_RULES.md §4). Throw-away spikes (spikes/*) may too.',
      severity: 'error',
      from: { pathNot: '^(packages/music-engine|spikes/[^/]+)/' },
      to: { path: 'node_modules/@coderline/alphatab' },
    },
    {
      name: 'no-import-of-spikes',
      comment: 'Spike code is never imported by apps or packages (MUSIC_ENGINE.md §10).',
      severity: 'error',
      from: { pathNot: '^spikes/' },
      to: { path: '^spikes/' },
    },
    {
      name: 'no-spike-to-spike',
      comment: 'Spikes are independent experiments and never import each other.',
      severity: 'error',
      from: { path: '^spikes/([^/]+)/' },
      to: { path: '^spikes/', pathNot: '^spikes/$1/' },
    },
    {
      name: 'no-spike-to-app',
      comment: 'Spikes may use shared packages but never import apps.',
      severity: 'error',
      from: { path: '^spikes/' },
      to: { path: '^apps/' },
    },
    {
      name: 'spike-eslint-preset-only-in-spikes',
      comment: 'The spike ESLint preset lifts the alphaTab ban, so only spikes may use it.',
      severity: 'error',
      from: { pathNot: '^spikes/[^/]+/' },
      to: { path: '^packages/config/eslint/spike\\.js$' },
    },
    {
      name: 'pure-packages-no-ui-frameworks',
      comment: 'Pure packages must not depend on React, Next.js or React Native.',
      severity: 'error',
      from: { path: PURE },
      to: { path: 'node_modules/(react|react-dom|next|react-native)/' },
    },
    {
      name: 'music-model-is-a-leaf',
      comment: 'music-model depends on no other workspace package.',
      severity: 'error',
      from: { path: '^packages/music-model/' },
      to: { path: '^packages/', pathNot: '^packages/(music-model|config)/' },
    },
    {
      name: 'domain-packages-only-depend-on-music-model',
      comment: 'editor-core, practice-core, midi-engine, piano-visualizer → music-model only.',
      severity: 'error',
      from: { path: '^packages/(editor-core|practice-core|midi-engine|piano-visualizer)/' },
      to: { path: '^packages/', pathNot: '^packages/(music-model|config|$1)/' },
    },
    {
      name: 'editor-core-zustand-vanilla-only',
      comment: 'editor-core may use zustand/vanilla but not the React bindings.',
      severity: 'error',
      from: { path: '^packages/editor-core/' },
      to: { path: 'node_modules/zustand/', pathNot: 'node_modules/zustand/(esm/)?vanilla' },
    },
    {
      name: 'ui-only-depends-on-design-tokens',
      severity: 'error',
      from: { path: '^packages/ui/' },
      to: { path: '^packages/', pathNot: '^packages/(ui|design-tokens|config)/' },
    },
    {
      name: 'no-generated-client-outside-api-client',
      comment: 'Consumers import the api-client public API, not its generated internals.',
      severity: 'error',
      from: { pathNot: '^packages/api-client/' },
      to: { path: '^packages/api-client/src/generated/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: [
        '^apps/api/',
        // Our own build output only. node_modules stays in the graph as leaf modules (doNotFollow),
        // otherwise rules on node_modules targets (alphaTab, React, zustand) could never match.
        '^(apps|packages|spikes)/[^/]+/(dist|\\.next|coverage|playwright-report|test-results|node_modules)/',
      ],
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'default'],
      mainFields: ['types', 'module', 'main'],
    },
  },
};
