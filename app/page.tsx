import Link from 'next/link';
import { ArrowRight, Blocks, Braces, FileText, Sparkles } from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'File-based content',
    description: 'Type-safe MDX collections generated from a plain content folder.',
  },
  {
    icon: Blocks,
    title: 'Rich primitives',
    description: 'Cards, callouts, tabs, steps, accordions, and polished code blocks.',
  },
  {
    icon: Braces,
    title: 'React inside MDX',
    description: 'A custom interactive component rendered directly from an MDX file.',
  },
];

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-fd-background text-fd-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.18),transparent_62%)]" />
      <nav className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-xl border border-fd-border bg-fd-card shadow-sm">
            <Sparkles className="size-4 text-violet-500" />
          </span>
          MDX Lab
        </Link>
        <Link
          href="/docs"
          className="rounded-full border border-fd-border bg-fd-card/80 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur transition hover:bg-fd-accent"
        >
          Open the docs
        </Link>
      </nav>

      <section className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-6 pb-24 pt-20 text-center md:pt-28">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">
          <span className="size-1.5 rounded-full bg-violet-500" />
          Next.js 16 + Fumadocs
        </div>
        <h1 className="max-w-4xl text-balance text-5xl font-semibold tracking-[-0.045em] sm:text-7xl">
          A small laboratory for{' '}
          <span className="bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
            expressive MDX
          </span>
        </h1>
        <p className="mt-7 max-w-2xl text-balance text-base leading-7 text-fd-muted-foreground sm:text-lg">
          Explore how Fumadocs turns local MDX files into a modern, searchable documentation experience—with rich content and real React components.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/docs"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-fd-primary px-5 text-sm font-medium text-fd-primary-foreground shadow-lg shadow-violet-500/10 transition hover:opacity-90"
          >
            Start exploring <ArrowRight className="size-4" />
          </Link>
          <a
            href="https://fumadocs.dev"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-full border border-fd-border bg-fd-card px-5 text-sm font-medium transition hover:bg-fd-accent"
          >
            Fumadocs documentation
          </a>
        </div>

        <div className="mt-24 grid w-full gap-4 text-left md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-fd-border bg-fd-card/65 p-6 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-fd-card"
            >
              <feature.icon className="mb-5 size-5 text-violet-500" />
              <h2 className="font-medium tracking-tight">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
