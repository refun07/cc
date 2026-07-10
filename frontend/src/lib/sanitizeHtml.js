/**
 * Allowlist HTML sanitizer for rich-text fields (centre descriptions).
 * Anything not explicitly allowed is unwrapped or dropped, so stored markup can
 * never introduce scripts, inline handlers or javascript: URLs.
 * The server sanitizes too — this is the render-time second line of defence.
 */
const ALLOWED_TAGS = new Set([
  "P", "BR", "STRONG", "B", "EM", "I", "U", "S", "H2", "H3",
  "UL", "OL", "LI", "A", "BLOCKQUOTE", "IMG", "IFRAME",
]);
const ALLOWED_ATTRS = {
  A: ["href", "target", "rel"],
  IMG: ["src", "alt", "width"],
  IFRAME: ["src", "width", "allowfullscreen"],
};
const SAFE_LINK = /^(https?:|mailto:|tel:)/i;
/** Images: remote http(s), our own /storage uploads, or inline data images. */
const SAFE_IMG = /^(https?:\/\/|\/storage\/|data:image\/(png|jpe?g|gif|webp|avif);base64,)/i;
/** Embeds: YouTube only, and only the /embed/ player URL. */
const SAFE_EMBED = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\/[\w-]{6,}(\?[\w=&;-]*)?$/i;
/** Resize widths we allow (percent). */
const SAFE_WIDTH = /^(25|50|75|100)%$/;

export function sanitizeHtml(dirty) {
  if (!dirty) return "";
  const doc = new DOMParser().parseFromString(`<div>${dirty}</div>`, "text/html");
  const root = doc.body.firstChild;

  const walk = (node) => {
    // Iterate over a copy: we mutate the tree as we go.
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) { child.remove(); continue; }

      const tag = child.tagName;

      if (!ALLOWED_TAGS.has(tag)) {
        walk(child);                                  // keep the text, drop the tag
        child.replaceWith(...child.childNodes);
        continue;
      }

      const allowed = ALLOWED_ATTRS[tag] || [];
      for (const attr of [...child.attributes]) {
        if (!allowed.includes(attr.name.toLowerCase())) child.removeAttribute(attr.name);
      }

      if (tag === "A") {
        const href = child.getAttribute("href") || "";
        if (!SAFE_LINK.test(href)) child.removeAttribute("href");
        else { child.setAttribute("target", "_blank"); child.setAttribute("rel", "noopener noreferrer"); }
      }

      if (tag === "IMG") {
        if (!SAFE_IMG.test(child.getAttribute("src") || "")) { child.remove(); continue; }
        if (!SAFE_WIDTH.test(child.getAttribute("width") || "")) child.removeAttribute("width");
      }

      if (tag === "IFRAME") {
        if (!SAFE_EMBED.test(child.getAttribute("src") || "")) { child.remove(); continue; }
        child.setAttribute("allowfullscreen", "");
        if (!SAFE_WIDTH.test(child.getAttribute("width") || "")) child.removeAttribute("width");
      }

      walk(child);
    }
  };

  walk(root);
  return root.innerHTML;
}

/** Turn any YouTube URL into its canonical /embed/ URL, or null if it isn't one. */
export function youtubeEmbedUrl(raw) {
  if (!raw) return null;
  let url;
  try { url = new URL(raw.trim()); } catch { return null; }
  const host = url.hostname.replace(/^www\./, "");
  let id = null;

  if (host === "youtu.be") id = url.pathname.slice(1);
  else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else if (url.pathname.startsWith("/embed/")) id = url.pathname.split("/")[2];
    else if (url.pathname.startsWith("/shorts/")) id = url.pathname.split("/")[2];
  }

  return /^[\w-]{6,}$/.test(id || "") ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

/** Plain-text preview of rich HTML (for cards, meta descriptions, etc.). */
export function htmlToText(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}
