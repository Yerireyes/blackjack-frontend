import { afterEach } from 'vitest';

// Solo los tests de componentes (jsdom) necesitan Testing Library.
if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => cleanup());
}
