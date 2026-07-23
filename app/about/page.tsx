import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About — Bite o'Clock" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-10">
      <h1 className="font-display text-4xl font-semibold text-ink">
        Houston eats better at happy hour.
      </h1>
      <p className="text-muted">
        Bite o&rsquo;Clock is a crowdsourced directory of every <strong>food</strong> happy hour in
        Houston. Not the drink specials — the $1 oysters, the $5 queso, the half-price sushi that
        makes a Tuesday at 4pm the best meal of your week.
      </p>
      <div className="space-y-4">
        <h2 className="font-display text-2xl font-semibold text-ink">How it works</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>
            Someone spots a happy hour menu and <Link href="/submit" className="text-primary underline underline-offset-2">snaps a photo</Link>.
          </li>
          <li>AI reads the menu — dishes, prices, days, hours — and matches it to the restaurant.</li>
          <li>A human moderator double-checks it. Then it&rsquo;s live for everyone.</li>
          <li>Diners confirm deals are still real when they visit, so listings stay fresh.</li>
        </ol>
      </div>
      <div className="space-y-4">
        <h2 className="font-display text-2xl font-semibold text-ink">Built in the open</h2>
        <p className="text-sm text-muted">
          The whole site is open source. Found a bug, want a feature, or want to help moderate?{" "}
          <a
            href="https://github.com/junglerhino37/bite-oclock"
            className="text-primary underline underline-offset-2"
          >
            Join us on GitHub
          </a>
          . Houston only, for now and the foreseeable future — depth beats breadth.
        </p>
      </div>
      <p className="rounded-2xl bg-sunken px-5 py-4 text-xs text-muted">
        Deals change without notice and restaurants have moods. Always confirm with the restaurant
        before driving across town for oysters. We&rsquo;re a community project, not a guarantee.
      </p>
    </div>
  );
}
