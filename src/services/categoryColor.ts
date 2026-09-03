/**
 * A deterministic colour per category, with nothing stored anywhere.
 *
 * The category name is already the identity — "Food" is "Food" wherever it
 * appears, unlike an entry or payment with its own id. Hashing the string to
 * a fixed palette gives every list the same colour for the same category for
 * free, with no color field to add to the data model, sync, or merge.
 *
 * The palette is eight hues picked to read clearly against both this app's
 * light and dark surfaces at once — CSS custom properties do the actual
 * per-theme adjustment, this just picks which one.
 */

const PALETTE_SIZE = 8;

/** A small, fast string hash — this only has to spread categories across 8
 * buckets evenly, not resist anything. */
function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

/**
 * A palette index, 0-7, stable for a given category name. Blank categories
 * — "uncategorised" — always land on 0, the neutral slot, rather than
 * hashing an empty string to something arbitrary.
 */
export function categoryColorIndex(category: string): number {
  const trimmed = category.trim();
  if (!trimmed) return 0;
  return 1 + (hashString(trimmed) % (PALETTE_SIZE - 1));
}
