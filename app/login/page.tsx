"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useSession } from "@/components/SessionProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { LoadingRing, PageLoader } from "@/components/ui/loading-ring";

export default function LoginPage() {
  const router = useRouter();
  const { me, refresh } = useSession();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  // Set once this page starts authenticating, so the "already signed in"
  // redirect below doesn't steal the destination we picked for the new session
  // (signup goes to onboarding, not /topics).
  const [authenticating, setAuthenticating] = useState(false);

  // Nothing to log into with a live session — send them to their studies.
  useEffect(() => {
    if (me && !authenticating) router.replace("/topics");
  }, [me, authenticating, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setAuthenticating(true);
    try {
      if (mode === "signup") {
        await api("/api/auth/signup", {
          body: { email, password, displayName: displayName || undefined },
        });
        // The layout (and its topbar) doesn't remount on a client navigation,
        // so the new session has to be picked up before we leave this page.
        await refresh();
        toast.success("Account created — welcome to LearnPath!");
        router.push("/onboarding?new=1");
      } else {
        await api("/api/auth/login", { body: { email, password } });
        await refresh();
        toast.success("Welcome back!");
        // Straight to the studies rather than bouncing off "/" (which only
        // redirects here anyway, after mounting the WebGL landing page).
        router.push("/topics");
      }
    } catch (err) {
      setAuthenticating(false);
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const isLogin = mode === "login";

  // Hold the loader while the session resolves, and while the redirect above is
  // in flight, so a signed-in learner never sees the form.
  if (me === undefined || (me && !authenticating)) return <PageLoader />;

  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
          LearnPath
        </p>
        <CardTitle className="h-display text-3xl">
          {isLogin ? "Welcome back." : "Start something."}
        </CardTitle>
        <CardDescription>
          {isLogin
            ? "Pick up where you left off."
            : "Personalized paths begin with a sign-up."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup>
            {!isLogin && (
              <Field>
                <FieldLabel htmlFor="displayName">Display name</FieldLabel>
                <Input
                  id="displayName"
                  placeholder="Optional"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                required
                minLength={isLogin ? undefined : 8}
                placeholder={isLogin ? undefined : "At least 8 characters"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy && <LoadingRing data-icon="inline-start" />}
              {isLogin ? "Log in" : "Sign up"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-muted-foreground text-sm">
          {isLogin ? "No account?" : "Have an account?"}{" "}
          <button
            type="button"
            className="text-primary font-medium hover:underline"
            onClick={() => setMode(isLogin ? "signup" : "login")}
          >
            {isLogin ? "Sign up" : "Log in"}
          </button>
        </p>
      </CardFooter>
    </Card>
  );
}
