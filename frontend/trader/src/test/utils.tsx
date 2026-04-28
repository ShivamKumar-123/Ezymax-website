import { render, type RenderOptions } from '@testing-library/react';
import { type ReactElement } from 'react';

/**
 * Custom render function that wraps components with all necessary providers.
 * Use this instead of @testing-library/react's render() in all tests.
 *
 * @example
 * import { renderWithProviders, screen } from '@/test/utils';
 * renderWithProviders(<MyComponent />);
 * expect(screen.getByText('hello')).toBeInTheDocument();
 */
function AllProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { renderWithProviders as render };
