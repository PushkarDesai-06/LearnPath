import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { requireUserOrRedirect } from "@/lib/auth/current";
import { listTopics } from "@/lib/data/topics";
import { initials } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Kbd } from "@/components/ui/kbd";
import { LogoutButton } from "@/components/LogoutButton";
import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";
import { SHORTCUTS } from "@/components/shell/shortcuts";
import { AccountNav } from "./AccountNav";
import { AppearanceSection } from "./AppearanceSection";

// Rendered on the server, so pin locale and zone: the output must not depend
// on where the server happens to run.
const MEMBER_SINCE = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const KEY_CONNECTORS = new Set(["then", "or"]);

export default async function AccountPage() {
  const user = await requireUserOrRedirect();
  // Topics double as the account's learning rollup, so no extra query.
  const topics = await listTopics(user._id.toHexString());
  const { email } = user;
  const displayName = user.displayName ?? null;
  const createdAt = user.createdAt;

  const totals = topics.reduce(
    (acc, t) => ({
      lessonsMastered: acc.lessonsMastered + t.summary.lessonsMastered,
      lessonsTotal: acc.lessonsTotal + t.summary.lessonsTotal,
      modulesCompleted: acc.modulesCompleted + t.summary.modulesCompleted,
      modulesTotal: acc.modulesTotal + t.summary.modulesTotal,
      mastery: acc.mastery + t.summary.overallMastery,
    }),
    {
      lessonsMastered: 0,
      lessonsTotal: 0,
      modulesCompleted: 0,
      modulesTotal: 0,
      mastery: 0,
    },
  );
  // Mean of the per-topic averages: every topic counts the same, regardless of
  // how many lessons it happens to hold.
  const avgMastery =
    topics.length > 0 ? Math.round((totals.mastery / topics.length) * 100) : 0;

  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Account" }]} />
      <PageContainer>
        <div className="grid gap-6 md:grid-cols-[160px_minmax(0,1fr)] md:gap-12">
          <AccountNav />

          <div className="flex min-w-0 max-w-[680px] flex-col gap-12">
            <Section id="profile" title="Profile">
              <div className="mb-4 flex items-center gap-3">
                <Avatar size="lg">
                  <AvatarFallback className="font-medium">
                    {initials(email, displayName)}
                  </AvatarFallback>
                </Avatar>
                <h1 className="truncate text-lg font-semibold tracking-tight">
                  {displayName || email.split("@")[0]}
                </h1>
              </div>
              <dl>
                <Row label="Name" value={displayName || "Not set"} />
                <Row label="Email" value={email} mono />
                <Row
                  label="Member since"
                  value={
                    <time dateTime={createdAt.toISOString()}>
                      {MEMBER_SINCE.format(createdAt)}
                    </time>
                  }
                />
                <Row label="Topics" value={String(topics.length)} />
                <Row
                  label="Lessons mastered"
                  value={`${totals.lessonsMastered}/${totals.lessonsTotal}`}
                />
                <Row
                  label="Modules done"
                  value={`${totals.modulesCompleted}/${totals.modulesTotal}`}
                />
                <Row label="Average mastery" value={`${avgMastery}%`} />
              </dl>
              <div className="mt-4">
                {topics.length === 0 ? (
                  <Button asChild size="sm">
                    <Link href="/onboarding?new=1">
                      <Plus data-icon="inline-start" />
                      New topic
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/topics">
                      All topics
                      <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                )}
              </div>
            </Section>

            <Section
              id="appearance"
              title="Appearance"
              description="System follows your device."
            >
              <AppearanceSection />
            </Section>

            <Section
              id="shortcuts"
              title="Shortcuts"
              description="Single key shortcuts are ignored while you type."
            >
              <div className="flex flex-col gap-6">
                {SHORTCUTS.map((group) => (
                  <div key={group.group}>
                    <h3 className="pb-1 text-[11.5px] font-medium text-faint">
                      {group.group}
                    </h3>
                    <table className="w-full text-[13px]">
                      <tbody>
                        {group.items.map((item) => (
                          <tr
                            key={item.label}
                            className="h-9 border-b border-border last:border-b-0"
                          >
                            <td className="text-fg-2">{item.label}</td>
                            <td className="text-right">
                              <span className="inline-flex items-center gap-1">
                                {item.keys.map((key, i) =>
                                  KEY_CONNECTORS.has(key) ? (
                                    <span
                                      key={`${key}-${i}`}
                                      className="px-0.5 text-[12px] text-faint"
                                    >
                                      {key}
                                    </span>
                                  ) : (
                                    <Kbd key={`${key}-${i}`}>{key}</Kbd>
                                  ),
                                )}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              id="account"
              title="Account"
              description="Signing out ends this session on this device."
            >
              <LogoutButton />
            </Section>
          </div>
        </div>
      </PageContainer>
    </>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16">
      <div className="mb-4 border-b border-border pb-2">
        <h2 id={`${id}-title`} className="text-[15px] font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex h-10 items-center justify-between gap-4 border-b border-border text-[13px] last:border-b-0">
      <dt className="text-fg-2">{label}</dt>
      <dd className={mono ? "truncate font-mono text-[12.5px]" : "truncate"}>
        {value}
      </dd>
    </div>
  );
}
