import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router";
import { AuthProvider } from "../lib/auth";
import { routes } from "../router";

export function renderWithProviders(initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const memoryRouter = createMemoryRouter(routes, { initialEntries });

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={memoryRouter} />
      </AuthProvider>
    </QueryClientProvider>,
  );

  return { ...utils, router: memoryRouter, queryClient };
}
