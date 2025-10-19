export function slugify(label) {
  return (label || '')
    .toLowerCase()
    .replace(/[\/&+]/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
