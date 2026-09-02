import type { ProductRating, ReviewPublic } from "./database.types";
import { describeError, supabase } from "./supabase";

export type SubmitReviewInput = {
  productSlug: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
};

/**
 * Published reviews for one product, newest first.
 *
 * Reads reviews_public rather than the table, so the helpful count is the real
 * total across all shoppers and voted_by_me is answered in the same round trip.
 * An empty list is a legitimate answer — a product nobody has reviewed yet —
 * so callers fall back to src/data/reviews.ts only when `ready` is false.
 */
export async function fetchReviews(
  productSlug: string,
): Promise<{ reviews: ReviewPublic[]; ready: boolean }> {
  const { data, error } = await supabase
    .from("reviews_public")
    .select("*")
    .eq("product_slug", productSlug)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  // The table not existing yet is the one error worth treating as "no data";
  // anything else still means the caller should show what it has.
  if (error || !data) return { reviews: [], ready: false };

  return { reviews: data, ready: true };
}

/** The star breakdown for one product, totalled by the product_ratings view. */
export async function fetchRating(productSlug: string): Promise<ProductRating | null> {
  const { data, error } = await supabase
    .from("product_ratings")
    .select("*")
    .eq("product_slug", productSlug)
    .maybeSingle();

  if (error || !data) return null;

  return data;
}

/** Star breakdowns for the whole catalogue, keyed by slug, for the grid. */
export async function fetchRatings(): Promise<Map<string, ProductRating>> {
  const { data, error } = await supabase.from("product_ratings").select("*");

  if (error || !data) return new Map();

  return new Map(data.map((row) => [row.product_slug, row]));
}

/**
 * Writes a review for the signed-in shopper.
 *
 * `verified` is deliberately not passed: a trigger sets it from the reviewer's
 * own order history, so the badge means something. The unique constraint on
 * (product_slug, user_id) is what stops one person reviewing a product twice.
 */
export async function submitReview(
  input: SubmitReviewInput,
): Promise<{ review: ReviewPublic | null; error: string | null }> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;

  if (userId === undefined) {
    return { review: null, error: "You need to be signed in to write a review." };
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      product_slug: input.productSlug,
      user_id: userId,
      author_name: input.authorName.trim(),
      rating: input.rating,
      title: input.title.trim(),
      body: input.body.trim(),
    })
    .select()
    .single();

  if (error) {
    if (/duplicate key|reviews_product_slug_user_id_key/i.test(error.message)) {
      return { review: null, error: "You have already reviewed this product." };
    }
    return { review: null, error: describeError(error) };
  }

  return { review: { ...data, helpful_count: 0, voted_by_me: false }, error: null };
}

/** Edits the caller's own review. Only the rating and the words can change. */
export async function updateReview(
  reviewId: number,
  patch: { rating?: number; title?: string; body?: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("reviews").update(patch).eq("id", reviewId);

  return { error: error ? describeError(error) : null };
}

/** Removes the caller's own review. */
export async function deleteReview(reviewId: number): Promise<{ error: string | null }> {
  const { error } = await supabase.from("reviews").delete().eq("id", reviewId);

  return { error: error ? describeError(error) : null };
}

/**
 * Toggles the caller's "helpful" vote on a review.
 *
 * The vote is a row rather than a counter, so a shopper can only ever be worth
 * one vote no matter how many times they click, and taking it back is a delete.
 */
export async function toggleHelpful(
  reviewId: number,
  currentlyVoted: boolean,
): Promise<{ voted: boolean; error: string | null }> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;

  if (userId === undefined) {
    return { voted: currentlyVoted, error: "You need to be signed in to vote." };
  }

  if (currentlyVoted) {
    const { error } = await supabase
      .from("review_votes")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", userId);

    return { voted: error ? true : false, error: error ? describeError(error) : null };
  }

  const { error } = await supabase
    .from("review_votes")
    .insert({ review_id: reviewId, user_id: userId });

  return { voted: error ? false : true, error: error ? describeError(error) : null };
}
