<script setup lang="ts">
</script>

<template>
  <router-view />
</template>

<style>
:root {
  /* Colors */
  --color-primary: #4a90d9;
  --color-primary-hover: #357abd;
  --color-primary-light: #e8f4fd;
  --color-danger: #d9534f;
  --color-danger-light: #fce4e4;
  --color-danger-bg: #fdf2f2;
  --color-danger-border: #f5c6cb;
  --color-success: #388e3c;
  --color-success-light: #e8f5e9;
  --color-warning-bg: #fff3cd;
  --color-warning-text: #856404;
  --color-warning-border: #ffeeba;
  --color-text: #1a1a1a;
  --color-text-secondary: #555;
  --color-text-muted: #888;
  --color-text-heading: #333;
  --color-bg: #f5f5f5;
  --color-bg-white: #fff;
  --color-bg-hover: #f0f0f0;
  --color-bg-subtle: #fafafa;
  --color-border: #e5e5e5;
  --color-border-light: #ddd;
  --color-border-input: #ccc;

  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 0.75rem;
  --space-lg: 1rem;
  --space-xl: 1.5rem;
  --space-2xl: 2rem;

  /* Border radius */
  --radius-sm: 3px;
  --radius-md: 4px;
  --radius-lg: 6px;
  --radius-xl: 8px;

  /* Fonts */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  --font-mono: 'SFMono-Regular', 'Consolas', 'Liberation Mono', 'Menlo',
    monospace;

  /* Sidebar */
  --sidebar-width: 260px;

  /* Transitions */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.2s ease;
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--color-text);
  background-color: var(--color-bg);
}

/* Global focus styles for keyboard accessibility */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

button:focus:not(:focus-visible) {
  outline: none;
}

/* Global loading spinner */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.spinner {
  display: inline-block;
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.spinner--sm {
  width: 0.875rem;
  height: 0.875rem;
  border-width: 1.5px;
}

/* Responsive breakpoints used across views:
   - mobile: max-width 768px
   - tablet: 769px - 1024px
*/
</style>
