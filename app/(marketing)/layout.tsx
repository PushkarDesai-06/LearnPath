import "./landing.css";
import { LandingNav } from "./_components/LandingNav";

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="lp-landing flex min-h-full flex-1 flex-col overflow-x-clip">
      <LandingNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
