import Browse from "@/components/Browse";
import { getSpots, getNeighborhoods } from "@/lib/spots";

export default function HomePage() {
  return (
    <div className="space-y-8 pt-8">
      <section className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
          It&rsquo;s bite o&rsquo;clock <span className="text-primary">somewhere in Houston.</span>
        </h1>
        <p className="mt-3 text-base text-muted">
          Every food happy hour in town — crowdsourced by people who actually went, mapped by the
          hour. Always confirm with the restaurant; kitchens change their minds.
        </p>
      </section>
      <Browse spots={getSpots()} neighborhoods={getNeighborhoods()} />
    </div>
  );
}
