export function youtubeVideoId(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    let id = null;
    if (["youtu.be", "www.youtu.be"].includes(host)) id = url.pathname.slice(1).replace(/\/$/, "");
    if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
      id = url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]+)\/?$/)?.[1];
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : null;
  } catch {
    return null;
  }
}
