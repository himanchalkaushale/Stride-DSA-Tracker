import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import "./phase-two.css";
import "./phase-three.css";
import "./phase-four.css";
import "./plans.css";
import "./todos.css";
import "./usability.css";
import { ThemeProvider, themeBootstrapScript } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: { default: "Stride — DSA Progress Tracker", template: "%s · Stride" },
  description: "A focused daily system for mastering data structures and algorithms.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} /></head>
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
