export type ChatTextPart =
  | { type: "text"; value: string }
  | { type: "link"; href: string; label: string };

const URL_RE = /https?:\/\/[^\s]+/g;

export function splitChatLinks(text: string): ChatTextPart[] {
  const parts: ChatTextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    if (start > last) {
      parts.push({ type: "text", value: text.slice(last, start) });
    }
    const raw = match[0];
    const href = raw.replace(/[.,;:!?]+$/, "");
    parts.push({
      type: "link",
      href,
      label: /wa\.me\//i.test(href) ? "WhatsApp" : href,
    });
    last = start + href.length;
  }
  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }
  return parts.length > 0 ? parts : [{ type: "text", value: text }];
}
