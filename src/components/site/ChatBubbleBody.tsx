import { splitChatLinks } from "@/lib/chat-text";

function Inline({ text, carName = false }: { text: string; carName?: boolean }) {
  return splitChatLinks(text).map((part, index) => part.type === "link" ? (
    <a key={index} href={part.href} className={carName ? "font-display text-[16px] font-bold leading-5 text-cream underline decoration-brand decoration-2 underline-offset-[3px] hover:decoration-cream" : "font-bold text-cream underline decoration-white/30 underline-offset-[3px] hover:decoration-cream [overflow-wrap:anywhere]"}>{part.label}</a>
  ) : <span key={index}>{part.value.replace(/\*\*/g, "")}</span>);
}

const CAR_LINE = /^•\s+((?:\*\*)?\[[^\]]+\]\(\/estoque\/[^)]+\)(?:\*\*)?)\s+[—–-]\s+(.+)$/;

export function ChatBubbleBody({ text }: { text: string }) {
  // Oculta o link incompleto durante o stream e numa resposta truncada.
  text = text.replace(/(?:\*\*)?\[[^\]\n]*(?:\]\([^\)\n]*)?$/, "");
  const groups: { list: boolean; lines: string[] }[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim() || line.trim() === "•") continue;
    const list = /^•\s/.test(line.trim());
    const previous = groups.at(-1);
    if (previous?.list === list) previous.lines.push(line.trim());
    else groups.push({ list, lines: [line.trim()] });
  }
  return (
    <div className="w-fit max-w-full rounded-2xl rounded-tl-md bg-white/[0.06] px-4 py-3">
      {groups.map((group, index) => {
        if (!group.list) return <p key={index} className={`${index ? "mt-3 " : ""}text-pretty text-[14px] leading-[1.55] text-cream/95`}><Inline text={group.lines.join("\n")} /></p>;
        const cars = group.lines.map(line => line.match(CAR_LINE));
        if (cars.every(Boolean)) return <ul key={index} data-chat-car-blocks="1" className="mt-3 list-none space-y-3">
          {cars.map((car, carIndex) => <li key={carIndex} data-chat-car-block="" className="border-l-2 border-brand/70 pl-3">
            <p className="block"><Inline text={car![1]!} carName /></p>
            <p data-chat-car-prose="" className="mt-1 text-pretty text-[14px] leading-[1.55] text-cream/85"><Inline text={car![2]!} /></p>
          </li>)}
        </ul>;
        return <ul key={index} data-chat-rank-list="1" className="mt-3 list-none divide-y divide-white/[0.06] overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]">
          {group.lines.map((line, lineIndex) => <li key={lineIndex} className="px-3 py-2.5 text-[14px] leading-snug text-cream/90"><Inline text={line.replace(/^•\s+/, "")} /></li>)}
        </ul>;
      })}
    </div>
  );
}
