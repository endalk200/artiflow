# Manage shadcn Components

This monorepo keeps shadcn component source in `packages/ui` and consumes it from apps through the `@app/ui` workspace package.

## Structure

- `apps/web/components.json` is the app-aware shadcn config. Use this when adding shared components for the web app.
- `packages/ui/components.json` is the package-local config. Use it only for UI-package-only work; it does not see the Next.js app context.
- `packages/ui/src/components/*` contains the copied shadcn component source.
- `packages/ui/src/lib/utils.ts` contains the shared `cn()` helper.
- `packages/ui/src/styles/globals.css` is the Tailwind v4 and shadcn theme entrypoint.
- `apps/web/app/layout.tsx` imports `@app/ui/globals.css`.

The shared package exports `@app/ui/components/*`, `@app/ui/hooks/*`, `@app/ui/lib/*`, and `@app/ui/globals.css`. Application code should import shared UI through those package exports, for example:

```tsx
import { Button } from "@app/ui/components/button";
```

## Add a Component

Run shadcn from the app directory so the CLI sees the Next.js framework context and writes shared UI files through the `ui` alias in `apps/web/components.json`.

```bash
cd apps/web
bunx --bun shadcn@latest info
bunx --bun shadcn@latest docs button
bunx --bun shadcn@latest add button
```

For multiple components:

```bash
cd apps/web
bunx --bun shadcn@latest add dialog dropdown-menu input
```

After adding components, validate from the repo root so checks include `packages/ui` and `apps/web`:

```bash
cd ../..
bun turbo run check-types --force
bun turbo run build --force
bun run lint
```

## Preview an Update

Do not overwrite existing components directly. Preview the affected files first:

```bash
cd apps/web
bunx --bun shadcn@latest add button --dry-run
```

Then inspect upstream changes for each affected file listed by `--dry-run`:

```bash
bunx --bun shadcn@latest add button --diff ../../packages/ui/src/components/button.tsx
```

Read the local file, merge useful upstream changes manually, and preserve local behavior. Use `--overwrite` only with explicit approval or when you have confirmed the file has no local changes.

## Import Conventions

Application code should import shared components and utilities from `@app/ui`:

```tsx
import { Button } from "@app/ui/components/button";
import { cn } from "@app/ui/lib/utils";
```

Files inside `packages/ui` should use package-local imports defined by `packages/ui/package.json`:

```tsx
import { cn } from "#lib/utils";
```

When adding from `apps/web`, the CLI may generate `@app/ui/...` imports inside files written to `packages/ui`. Normalize those to `#...` imports when editing the file.

## Tailwind v4 Conventions

Do not create a `tailwind.config.js` for this setup. Tailwind is configured through CSS:

- Keep theme tokens in `packages/ui/src/styles/globals.css`.
- Keep `@source` entries in `packages/ui/src/styles/globals.css` for app and UI package paths that contain Tailwind classes.
- Keep the app PostCSS setup in `apps/web/postcss.config.mjs`.
- Import `@app/ui/globals.css` once from the app layout.

## Component Review Checklist

After adding or updating a component:

- Confirm the new files are under `packages/ui/src/components`.
- Confirm imports use `@app/ui/...` from apps.
- Read every changed file; fix missing imports, wrong aliases, and incorrect shadcn composition.
- Confirm component internals use the configured `lucide` icon library when icons are involved.
- Prefer shadcn component composition over custom styled markup.
- Use semantic Tailwind tokens such as `bg-background`, `text-foreground`, and `text-muted-foreground`.
- Use `cn()` for conditional classes.
- Run the repo-root validation commands above.
