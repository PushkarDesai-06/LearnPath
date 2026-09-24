"use client";

import { useActionState, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { loginAction, signupAction, type AuthFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { LoadingRing } from "@/components/ui/loading-ring";

const IDLE: AuthFormState = { error: null };

/**
 * Login / signup form. Submits to the auth Server Actions, which set the
 * session cookie and redirect (signup → onboarding, login → topics) in the
 * same round trip — the redirect also re-renders the root layout, so the Nav
 * already shows the new identity when the destination paints.
 */
export function LoginForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  // Controlled on purpose: React resets an action form's UNcontrolled fields
  // after each submit, which would wipe the email after a wrong password.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginState, login, loggingIn] = useActionState(loginAction, IDLE);
  const [signupState, signup, signingUp] = useActionState(signupAction, IDLE);

  const isLogin = mode === "login";
  // `pending` stays true through the redirect's navigation, so the button
  // keeps its busy label until the destination lands.
  const busy = loggingIn || signingUp;
  const error = isLogin ? loginState.error : signupState.error;

  // Surface each new failure as a toast too (the inline text stays).
  useEffect(() => {
    if (loginState.error) toast.error(loginState.error);
  }, [loginState]);
  useEffect(() => {
    if (signupState.error) toast.error(signupState.error);
  }, [signupState]);

  function toggleMode() {
    setMode(isLogin ? "signup" : "login");
    // Don't carry a revealed password across the switch.
    setShowPassword(false);
  }

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
        <form action={isLogin ? login : signup}>
          <FieldGroup>
            {!isLogin && (
              <Field>
                <FieldLabel htmlFor="displayName">Display name</FieldLabel>
                <Input
                  id="displayName"
                  name="displayName"
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
                name="email"
                type="email"
                autoComplete="email"
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
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
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
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
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
