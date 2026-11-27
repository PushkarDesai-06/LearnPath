"use client";

import { useActionState, useEffect, useState } from "react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { loginAction, signupAction, type AuthFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

const IDLE: AuthFormState = { error: null };

/**
 * Login / signup form. Submits to the auth Server Actions, which set the
 * session cookie and redirect (signup to onboarding, login to topics) in the
 * same round trip. The redirect also re-renders the root layout, so the Nav
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
  // keeps its spinner until the destination lands.
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
    <Card className="mx-auto max-w-sm gap-4 py-5 shadow-(--shadow-pop)">
      <CardHeader className="px-5">
        <Tabs value={mode} onValueChange={() => toggleMode()} className="mb-3">
          <TabsList className="w-full">
            <TabsTrigger value="login" disabled={busy}>
              Sign in
            </TabsTrigger>
            <TabsTrigger value="signup" disabled={busy}>
              Sign up
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <CardTitle className="text-lg font-semibold tracking-tight">
          {isLogin ? "Welcome back" : "Create your account"}
        </CardTitle>
        <CardDescription className="text-[13px]">
          {isLogin
            ? "Pick up where you left off."
            : "Personalized paths begin with a sign up."}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <form action={isLogin ? login : signup}>
          <FieldGroup className="gap-3.5">
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
                  aria-invalid={error ? true : undefined}
                  className="pr-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute inset-y-0 right-1 my-auto text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  aria-controls="password"
                  disabled={busy}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </Field>
            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md bg-destructive/10 px-2.5 py-2 text-[12.5px] text-destructive"
              >
                <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                {error}
              </p>
            )}
            <Button type="submit" size="lg" loading={busy} className="w-full">
              {isLogin ? "Sign in" : "Create account"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
