import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current";
import { FinalCta } from "./_components/FinalCta";
import { Features } from "./_components/Features";
import { Footer } from "./_components/Footer";
import { Hero } from "./_components/Hero";
import { HowItWorks } from "./_components/HowItWorks";

export default async function Home() {
  if (await getCurrentUser()) redirect("/topics");

  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <FinalCta />
      <Footer />
    </>
  );
}
