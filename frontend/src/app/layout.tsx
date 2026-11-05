import type { Metadata } from "next";
import { Provider } from "@/lib/context";
import "./globals.css";
import "./advanced.css";
import "./landing.css";
export const metadata: Metadata = {
  title: {
    default: "Utsab — Your moments, beautifully together",
    template: "%s · Utsab",
  },
  description:
    "One thoughtful workspace for weddings, birthdays, anniversaries, corporate events, and every reason to celebrate. Discover professionals, plan budgets, manage guests, and run your event business in Bangladesh.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
