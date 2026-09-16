"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
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
      // Deliberately leave `busy` set: the navigation above is still in flight,
      // and this page stays mounted until it lands. Clearing it here would flip
      // the button back to its idle label mid-redirect.
    } catch (err) {
      setAuthenticating(false);
      setBusy(false);
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const isLogin = mode === "login";

  function toggleMode() {
    setMode(isLogin ? "signup" : "login");
    // Don't carry a revealed password across the switch.
    setShowPassword(false);
  }

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
                  disabled={busy}
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
                disabled={busy}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={isLogin ? undefined : 8}
                  placeholder={isLogin ? undefined : "At least 8 characters"}
                  disabled={busy}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  // Sits inside the field's padding gutter; the input keeps the
                  // focus ring, so keep this one visually quiet.
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-1 my-auto"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  aria-controls="password"
                  disabled={busy}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </Button>
              </div>
            </Field>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {/* Inherit the button's foreground — the ring's default text-primary
                  is invisible against a primary-filled button. */}
              {busy && (
                <LoadingRing data-icon="inline-start" className="text-current" />
              )}
              {busy
                ? isLogin
                  ? "Logging in…"
                  : "Creating account…"
                : isLogin
                  ? "Log in"
                  : "Sign up"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-muted-foreground text-sm">
          {isLogin ? "No account?" : "Have an account?"}{" "}
          <button
            type="button"
            className="text-primary font-medium hover:underline disabled:pointer-events-none disabled:opacity-50"
            disabled={busy}
            onClick={toggleMode}
          >
            {isLogin ? "Sign up" : "Log in"}
          </button>
        </p>
      </CardFooter>
    </Card>
  );
}
