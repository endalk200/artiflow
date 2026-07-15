# Standardize JavaScript Toolchain

We use Bun as the only package manager, Node.js as the application runtime, Biome as the linting and formatting tool, and Vitest as the JavaScript and React test runner. Bun gives the workspace one fast installer and lockfile without mixing npm, pnpm, or Yarn state; Node remains the runtime because the Next.js ecosystem and deployment targets are optimized around it; Biome replaces separate ESLint and Prettier setup so linting and formatting share one configuration and one command surface; Vitest provides package-local unit and component tests that fit the Vite and React ecosystem without introducing a separate Jest toolchain.

## Consequences

Package installation and script execution should use `bun` and the committed `bun.lock`. Application code should continue to target Node.js runtime behavior, not Bun-specific runtime APIs. Formatting and linting rules should be expressed through Biome config, with check commands kept read-only and fix/write commands used for mutation. Test scripts should live in the package being tested and be orchestrated from the root with Turborepo.
