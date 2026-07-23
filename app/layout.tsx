import type { Metadata } from "next";
import { Fraunces, Inter, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import AuthButton from "@/components/AuthButton";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });

export const metadata: Metadata = {
  title: "Bite o'Clock — Houston food happy hours",
  description:
    "It's bite o'clock somewhere in Houston. Every food happy hour in town — crowdsourced, mapped by the hour.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${inter.variable} ${grotesk.variable} antialiased`}>
        <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
            <Link href="/" className="font-display text-xl font-semibold tracking-tight text-ink">
              Bite <span className="text-primary">o&rsquo;Clock</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/about"
                className="rounded-full px-3 py-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink"
              >
                About
              </Link>
              <Link
                href="/submit"
                className="rounded-full bg-primary px-4 py-1.5 font-medium text-white shadow-sm transition-colors hover:bg-primary-hover"
              >
                + Spot a deal
              </Link>
              <AuthButton />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-24">{children}</main>
        <footer className="border-t border-line bg-sunken/60">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>
              Made by Houstonians, for Houstonians. Deals are crowdsourced — always confirm with
              the restaurant.
            </p>
            <p>
              <a
                href="https://github.com/junglerhino37/bite-oclock"
                className="underline decoration-line underline-offset-4 hover:text-ink"
              >
                Contribute on GitHub
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
