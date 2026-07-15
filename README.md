# MDX Lab

A deliberately small experiment for rendering local MDX files with [Fumadocs](https://fumadocs.dev) and the Next.js App Router.

## What is included

- Next.js 16, React 19, TypeScript, and Tailwind CSS 4
- `fumadocs-mdx` as the type-safe local content source
- `fumadocs-ui` for the docs layout, navigation, search, themes, and MDX primitives
- Five statically generated MDX pages covering Markdown, code, UI components, and KaTeX math
- A custom interactive React component embedded directly in MDX
- A generated Orama search endpoint at `/api/search`

## Run the experiment

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The landing page links to the docs at `/docs`.

Useful checks:

```bash
npm run lint
npm run typecheck
npm run build
```

The scripts use Next.js' supported webpack mode because it is reliable with this Fumadocs MDX experiment. Fumadocs regenerates `.source` during install, development, and builds.

## Project map

```text
app/
  docs/[[...slug]]/page.tsx  # renders every MDX page
  api/search/route.ts        # Fumadocs search endpoint
components/
  mdx.tsx                    # shared MDX component registry
  mdx-playground.tsx         # custom interactive component
content/docs/                # the MDX experiment pages
lib/source.ts                # typed Fumadocs source adapter
source.config.ts             # content collection + math plugins
```

Start with [`content/docs/components.mdx`](content/docs/components.mdx) to see built-in and custom components used together.
