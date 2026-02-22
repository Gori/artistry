export function slugify(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanum → hyphens
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens

  return slug || "untitled";
}

export async function generateUniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const slug = slugify(base);
  if (!(await exists(slug))) return slug;

  let i = 2;
  while (await exists(`${slug}-${i}`)) {
    i++;
  }
  return `${slug}-${i}`;
}
