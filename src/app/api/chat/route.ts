import { handleChatGet, handleChatPost } from "@/lib/chat-http";

export const runtime = "nodejs";
export const maxDuration = 45;
// O health check (GET) não pode ser pré-renderizado no build: sempre responde do runtime.
export const dynamic = "force-dynamic";

export function GET() {
  return handleChatGet();
}

export function POST(request: Request) {
  return handleChatPost(request);
}
