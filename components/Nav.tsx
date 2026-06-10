"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";

interface Me {
  user: { email: string };
  onboarding: { status: string } | null;
}

export function Nav() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<Me>("/api/me")
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setMe(null);
    router.push("/login");
  }

  return (
    <nav className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-3 text-sm dark:border-gray-800 dark:bg-gray-950">
      <Link href="/" className="font-semibold">
        🎓 LearnPath
      </Link>
      {me && (
        <>
          <Link href="/topics" className="text-gray-600 hover:underline dark:text-gray-300">
            Topics
          </Link>
          <Link
            href="/onboarding?new=1"
            className="text-gray-600 hover:underline dark:text-gray-300"
          >
            New topic
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-gray-500">{me.user.email}</span>
            <button onClick={logout} className="text-blue-600 hover:underline">
              Log out
            </button>
          </div>
        </>
      )}
    </nav>
  );
}
