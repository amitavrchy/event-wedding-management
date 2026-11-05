"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context";
import { eventType } from "@/lib/event-types";
import { AuthScreen } from "./auth-screen";
import Link from "next/link";
export function AuthEntry({
  register = false,
  role = "HOST",
  occasion,
}: {
  register?: boolean;
  role?: "HOST" | "VENDOR";
  occasion?: string;
}) {
  const { user, ready, logout } = useApp();
  const differentRole = register && user && role !== user.role;
  const router = useRouter();
  useEffect(() => {
    if (occasion)
      sessionStorage.setItem("utsab-event-intent", eventType(occasion).type);
  }, [occasion]);
  useEffect(() => {
    if (!ready || !user || differentRole) return;
    if (user.role === "VENDOR") sessionStorage.removeItem("utsab-event-intent");
    router.replace(user.role === "VENDOR" ? "/business" : "/dashboard");
  }, [ready, user, router, differentRole]);
  if (ready && differentRole)
    return (
      <main className="auth-role-choice">
        <section>
          <Link className="brand" href="/">
            utsab<span>✳</span>
          </Link>
          <h1>Your next chapter</h1>
          <p>
            You’re signed in as {user.fullName}. This account uses the{" "}
            {user.role === "VENDOR" ? "business" : "host"} workspace. Use a
            separate {role === "VENDOR" ? "professional" : "host"} account to
            continue with this role.
          </p>
          <button className="button" onClick={logout}>
            Sign out and create an account
          </button>
          <Link href={user.role === "VENDOR" ? "/business" : "/dashboard"}>
            Continue to your workspace
          </Link>
        </section>
      </main>
    );
  return (
    <AuthScreen
      key={`${register}-${role}`}
      initialRegister={register}
      initialRole={role}
    />
  );
}
