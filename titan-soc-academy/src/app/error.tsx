"use client";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Something went wrong</h1>
      <p className="mt-2 text-fg-muted">Your saved progress is safe. Try again, or return to your dashboard.</p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="inline-flex h-11 items-center rounded-xl bg-accent px-5 font-medium text-accent-fg">Try again</button>
        <a href="/" className="inline-flex h-11 items-center rounded-xl border border-line-strong px-5 font-medium text-fg">Dashboard</a>
      </div>
    </main>
  );
}
