import type { Metadata } from "next";
import { Provider } from "@/lib/context";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Utsab — Your moments, beautifully together",
    template: "%s · Utsab",
  },
  description:
    "A thoughtful wedding and event workspace for Bangladesh. Discover vendors, plan your budget, manage guests, and bring every celebration together.",
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
