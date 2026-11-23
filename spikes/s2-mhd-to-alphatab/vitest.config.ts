import { defineConfig } from 'vitest/config';

// Node-only spike: conversion, comparison and ID-map tests. No coverage threshold (throw-away code).
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 60_000 },
});
