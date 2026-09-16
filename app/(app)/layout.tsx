/**
 * Layout for the signed-in product surface.
 *
 * Holds the reading-width container every app page expects. The landing page
 * lives in `(marketing)` instead, where it is free to run full-bleed.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      {children}
    </main>
  );
}
