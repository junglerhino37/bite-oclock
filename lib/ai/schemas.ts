import { z } from "zod";
import { CATEGORY_KEYS } from "@/lib/categories";
import { DAYS } from "@/lib/types";

const categoryEnum = z.enum(CATEGORY_KEYS as [string, ...string[]]);
const dayEnum = z.enum(DAYS as [string, ...string[]]);
const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();

/** What the vision model must return for a menu photo.
 * SECURITY: this is untrusted output derived from an untrusted image. It is
 * schema-validated here, stored as *pending* data for human moderation, and
 * never interpreted as instructions or auto-published. */
export const ExtractionSchema = z.object({
  is_menu: z.boolean(),
  restaurant_candidates: z.array(z.string().max(120)).max(5),
  happy_hour_days: z.array(dayEnum).max(7),
  start: hhmm,
  end: hhmm,
  deals: z
    .array(
      z.object({
        item: z.string().max(120),
        price: z.string().max(24).nullable(),
        category: categoryEnum,
        description: z.string().max(240).nullable().catch(null),
      }),
    )
    .max(40),
  confidence: z.number().min(0).max(1),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

/** A user-reviewed submission: the extraction after human edits on the review
 * screen, plus the restaurant name they settled on. Same trust boundary as the
 * extraction itself — validated server-side before persisting as *pending*. */
export const SubmissionSchema = z.object({
  restaurant_name: z.string().min(1).max(120),
  /** Set when the submission updates an existing spot (a new menu version). */
  spot_slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(80)
    .nullable()
    .optional(),
  /** Free-text submitter note for things the menu photo doesn't say
   * ("cash only", "bar seating only", "must order a drink"). */
  note: z.string().max(500).nullable().optional(),
  neighborhood: z.string().max(60).nullable(),
  days: z.array(dayEnum).max(7),
  start: hhmm,
  end: hhmm,
  deals: z
    .array(
      z.object({
        item: z.string().min(1).max(120),
        price: z.string().max(24).nullable(),
        category: categoryEnum,
        description: z.string().max(240).nullable(),
      }),
    )
    .min(1)
    .max(40),
});
export type Submission = z.infer<typeof SubmissionSchema>;

/** The ONLY thing the NL-query model may produce: a constrained filter object.
 * The model never writes SQL and never touches data directly — injection in a
 * user question can only yield a weird filter, not an exploit. */
export const QueryFilterSchema = z.object({
  food_terms: z.array(z.string().max(40)).max(6),
  categories: z.array(categoryEnum).max(8),
  neighborhood: z.string().max(60).nullable(),
  day: dayEnum.nullable(),
  live_now: z.boolean(),
  // Advisory only — an overlong hint must never sink the whole response,
  // so invalid values degrade to null instead of failing the parse.
  answer_style_hint: z.string().max(200).nullable().catch(null),
});
export type QueryFilter = z.infer<typeof QueryFilterSchema>;

/** "Add a deal" intent extracted from an Ask-bar sentence like
 * "add $1 oysters at julep". Data only — publishing still goes through the
 * normal /api/submit validation after the user confirms in the UI. */
export const AskAddSchema = z.object({
  restaurant_name: z.string().min(1).max(120),
  item: z.string().min(1).max(120),
  price: z.string().max(24).nullable(),
  category: categoryEnum,
  description: z.string().max(240).nullable().catch(null),
});
export type AskAdd = z.infer<typeof AskAddSchema>;

export const AskResponseSchema = z.object({
  intent: z.enum(["search", "add"]).catch("search"),
  filter: QueryFilterSchema.nullable(),
  add: AskAddSchema.nullable(),
});
export type AskResponse = z.infer<typeof AskResponseSchema>;
