import { handleChatGet, handleChatPost } from "@/lib/chat-http";

export const runtime = "nodejs";
export const maxDuration = 45;

export function GET() {
  return handleChatGet();
}

export function POST(request: Request) {
  return handleChatPost(request);
}
