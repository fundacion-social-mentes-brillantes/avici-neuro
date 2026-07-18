export function fluidPageText(value) {
  const text = String(value || "").replace(/\r\n?/g, "\n").trim();
  if (!text) return "(página en blanco)";
  return text
    .split(/\n\s*\n+/)
    .map(block => block.split("\n").map(line => line.trim()).filter(Boolean).join(" ").replace(/[ \t]{2,}/g, " "))
    .filter(Boolean)
    .join("\n\n");
}

export function getReaderPageModel(book, requestedPage, layout = "fluid") {
  const pages = Array.isArray(book?.pages) ? book.pages : [];
  if (!pages.length) return null;
  const pageNumber = Math.max(1, Math.min(pages.length, Number(requestedPage) | 0));
  const sourcePage = pages[pageNumber - 1];
  const rawText = sourcePage?.text || "(página en blanco)";
  return {
    sourcePage,
    pageNumber,
    total: pages.length,
    rawText,
    visibleText: layout === "original" ? rawText : fluidPageText(rawText),
    percent: Math.max(0, Math.min(100, (pageNumber / pages.length) * 100)),
  };
}
