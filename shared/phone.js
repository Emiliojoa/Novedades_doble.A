// Require an explicit country code; never guess the destination of a local number.
export function internationalPhone(value = "") {
  const compact = value
    .trim()
    .replace(/[\s()-]/g, "")
    .replace(/^00/, "+");
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : "";
}
