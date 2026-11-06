/**
 * The one empty-state pattern: icon, title, a line of explanation and at most
 * one action. Every "nothing here" screen uses it so they read the same.
 */
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  headingLevel = 2,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  action?: { href: string; label: string; variant?: "default" | "secondary" };
  /** 1 when the empty state IS the page (no other heading above it). */
  headingLevel?: 1 | 2;
  className?: string;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <Empty className={cn("border-border/60 border", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <Heading data-slot="empty-title" className="font-heading text-lg font-medium tracking-tight">
          {title}
        </Heading>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && (
        <EmptyContent>
          <Button asChild variant={action.variant ?? "default"}>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
