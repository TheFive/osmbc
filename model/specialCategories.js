/**
 * Category names with a special meaning in the workflow. They are stored
 * in `article.categoryEN` and listed in the category translations, so the
 * values must never change.
 */

/** Articles that stay with the blog but are never published (reason in `unpublishReason`). */
export const UNPUBLISHED = "--unpublished--";

/** Placeholder of a new article until an editor picks a real category. */
export const NO_CATEGORY_YET = "-- no category yet --";
