import type { Metadata } from "next";
import { AuthEntry } from "@/components/auth-entry";
export const metadata: Metadata = { title: "Sign in to your workspace" };
export default function Login() {
  return <AuthEntry />;
}
