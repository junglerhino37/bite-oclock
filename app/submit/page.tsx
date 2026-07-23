import { getAllSpots } from "@/lib/live";
import SubmitClient from "./submit-client";

/** /submit — new spot; /submit?spot=<slug> — update that restaurant's happy
 * hour (new menu snapshot becomes the current version, old one → history).
 * All known spots ride along so the review screen can catch duplicates —
 * one listing per physical restaurant ("Boheme" must land on "Bar Boheme"). */
export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ spot?: string }>;
}) {
  const { spot } = await searchParams;
  const spots = await getAllSpots();
  const target = spot ? spots.find((s) => s.slug === spot) : undefined;
  return (
    <SubmitClient
      target={target ? { slug: target.slug, name: target.name } : null}
      knownSpots={spots.map((s) => ({ slug: s.slug, name: s.name, address: s.address }))}
    />
  );
}
