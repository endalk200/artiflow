'use client';

import { Check, Code2, FileText, Paintbrush, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';

const options = [
  { id: 'syntax', label: 'Syntax highlighting', icon: Code2 },
  { id: 'theme', label: 'Theme tokens', icon: Paintbrush },
  { id: 'toc', label: 'Generated TOC', icon: FileText },
] as const;

type OptionId = (typeof options)[number]['id'];

export function MdxPlayground({ defaultAccent = 'violet' }: { defaultAccent?: 'violet' | 'cyan' }) {
  const [enabled, setEnabled] = useState<OptionId[]>(['syntax', 'theme']);
  const [accent, setAccent] = useState<'violet' | 'cyan'>(defaultAccent);

  const score = useMemo(() => 70 + enabled.length * 10, [enabled]);

  function toggle(id: OptionId) {
    setEnabled((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  const accentStyles =
    accent === 'violet'
      ? 'from-violet-500 to-fuchsia-500 shadow-violet-500/15'
      : 'from-cyan-500 to-blue-500 shadow-cyan-500/15';

  return (
    <div className="not-prose my-8 overflow-hidden rounded-2xl border border-fd-border bg-fd-card shadow-xl shadow-black/5">
      <div className="flex flex-col gap-2 border-b border-fd-border bg-fd-muted/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-violet-500" />
            Custom MDX component
          </div>
          <p className="mt-1 text-xs text-fd-muted-foreground">This entire panel is a client-side React component.</p>
        </div>
        <div className="flex rounded-full border border-fd-border bg-fd-background p-1">
          {(['violet', 'cyan'] as const).map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setAccent(color)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                accent === color ? 'bg-fd-primary text-fd-primary-foreground' : 'text-fd-muted-foreground hover:text-fd-foreground'
              }`}
            >
              {color}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-[1fr_0.9fr]">
        <div className="space-y-2">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-fd-muted-foreground">Build your page</p>
          {options.map((option) => {
            const active = enabled.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggle(option.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition ${
                  active ? 'border-fd-primary/25 bg-fd-primary/5' : 'border-fd-border hover:bg-fd-accent/50'
                }`}
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-fd-background shadow-sm">
                  <option.icon className="size-4" />
                </span>
                <span className="flex-1 font-medium">{option.label}</span>
                <span
                  className={`flex size-5 items-center justify-center rounded-full border transition ${
                    active ? 'border-fd-primary bg-fd-primary text-fd-primary-foreground' : 'border-fd-border'
                  }`}
                >
                  {active && <Check className="size-3" />}
                </span>
              </button>
            );
          })}
        </div>

        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${accentStyles} p-px shadow-lg`}>
          <div className="flex h-full min-h-52 flex-col rounded-[15px] bg-zinc-950 p-5 text-white">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-red-400" />
              <span className="size-2 rounded-full bg-amber-400" />
              <span className="size-2 rounded-full bg-emerald-400" />
            </div>
            <div className="my-auto py-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">render confidence</p>
              <p className="mt-2 text-5xl font-semibold tracking-tighter">{score}%</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${accentStyles} transition-all duration-500`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
            <code className="text-xs text-zinc-400">
              &lt;MdxPlayground accent=&quot;{accent}&quot; /&gt;
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
