import type { Metadata } from "next";
import { AuthEntry } from "@/components/auth-entry";
export const metadata: Metadata = { title: "Start your next celebration" };
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; role?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthEntry
      register
      role={params.role === "VENDOR" ? "VENDOR" : "HOST"}
      occasion={params.event}
    />
  );
}
