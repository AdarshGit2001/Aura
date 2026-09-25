import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aura — See Less. Understand More.",
  description: "An agentic sensory narrator for blind and low-vision users.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
