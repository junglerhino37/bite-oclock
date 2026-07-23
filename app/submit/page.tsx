import { getAnySpot } from "@/lib/live";
import SubmitClient from "./submit-client";

/** /submit — new spot; /submit?spot=<slug> — update that restaurant's happy
 * hour (new menu snapshot becomes the current version, old one → history). */
export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ spot?: string }>;
}) {
  const { spot } = await searchParams;
  const target = spot ? await getAnySpot(spot) : undefined;
  return <SubmitClient target={target ? { slug: target.slug, name: target.name } : null} />;
}
