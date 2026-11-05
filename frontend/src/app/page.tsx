import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
export const metadata: Metadata = {
  title: "Utsab — Every reason to celebrate",
  description:
    "Plan weddings, birthdays, anniversaries, corporate events, and the moments in between. One thoughtful workspace for hosts, planners, and event businesses in Bangladesh.",
};
export default function Home() {
  return <LandingPage />;
}
