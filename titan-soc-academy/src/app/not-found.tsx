import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-surface-3 text-fg-subtle"><Compass aria-hidden className="size-6" /></div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-fg">Page not found</h1>
      <p className="mt-2 text-fg-muted">The page you were looking for doesn’t exist or has moved.</p>
      <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-xl bg-accent px-5 font-medium text-accent-fg">Go to my dashboard</Link>
    </main>
  );
}
