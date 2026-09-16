/**
 * Layout for the signed-out marketing surface.
 *
 * Deliberately unconstrained: the landing page composes its own full-bleed
 * sections and sets its own rhythm, so no max-width or padding is imposed here.
 */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <main className="flex-1">{children}</main>;
}
