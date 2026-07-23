import Browse from "@/components/Browse";
import { getAllSpots } from "@/lib/live";
import { houstonNow } from "@/lib/spots";

// Re-render every 5 min so the "today" default tracks the clock; community
// writes revalidate this page immediately via revalidatePath.
export const revalidate = 300;

export default async function HomePage() {
  const spots = await getAllSpots();
  const neighborhoods = [...new Set(spots.map((s) => s.neighborhood))].sort();
  const today = houstonNow().day;
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
      <Browse spots={spots} neighborhoods={neighborhoods} today={today} />
    </div>
  );
}
