/**
 * Distraction free flows (onboarding, assessment): no sidebar, a slim bar with
 * the step and an Exit. Progress is saved server side, so leaving never confirms.
 */
import { FocusBar } from "@/components/shell/FocusBar";
import { PageContainer } from "@/components/shell/PageContainer";

export default function FocusLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-svh flex-col">
      <FocusBar />
      <main className="flex flex-1 flex-col">
        <PageContainer width="reading">{children}</PageContainer>
      </main>
    </div>
  );
}
