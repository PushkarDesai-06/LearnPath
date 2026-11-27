import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current";
import { LoginForm } from "./LoginForm";

/** Nothing to log into with a live session — send them to their studies. */
export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/topics");
  return <LoginForm />;
}
