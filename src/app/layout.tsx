import type { Metadata } from "next";
import "./globals.css";
import "./phase-two.css";
import "./phase-three.css";
import "./phase-four.css";
import "./usability.css";

export const metadata: Metadata = {
  title: { default: "Stride — DSA Progress Tracker", template: "%s · Stride" },
  description: "A focused daily system for mastering data structures and algorithms.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
