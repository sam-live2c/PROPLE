export function generateSearchData(data: { title?: string, body?: string, tags?: string[], category?: string, level?: string, authorName?: string, authorHandle?: string }) {
  const parts = [
    data.title || "",
    data.body || "",
    ...(data.tags || []),
    data.category || "",
    data.level || "",
    data.authorName || "",
    data.authorHandle || ""
  ];

  const text = parts.join(" ").toLowerCase();
  
  const words = text.split(/[^a-z0-9]+/g).filter(w => w.length > 2);
  const keywords = Array.from(new Set(words));

  return {
    keywords,
    titleLower: data.title?.toLowerCase() || "",
    normalizedText: text
  } as {
    keywords: string[],
    titleLower: string,
    normalizedText: string,
    category?: string,
    tags?: string[]
  };
}
