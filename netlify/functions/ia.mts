// "Montar 3D" da estrutura por desenho: chama o Claude pelo Netlify AI Gateway e devolve o texto em streaming
import type { Config } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";
import { autorizado, negado } from "../lib/auth.mts";

export default async (req: Request) => {
  if (!(await autorizado(req))) return negado();
  if (!process.env.ANTHROPIC_BASE_URL && !process.env.ANTHROPIC_API_KEY)
    return Response.json({ erro: "IA da Netlify ainda não está ativa neste site" }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.messages) || !body.messages.length) return Response.json({ erro: "pedido inválido" }, { status: 400 });
  const msgs = body.messages.slice(-12).map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") }));
  const imgs: any[] = Array.isArray(body.images) ? body.images.slice(0, 2) : [];
  if (imgs.length) {
    const last = msgs[msgs.length - 1];
    last.content = [...imgs.map((im) => ({ type: "image", source: { type: "base64", media_type: im.media_type || "image/png", data: im.data } })), { type: "text", text: last.content }];
  }
  const anthropic = new Anthropic();
  const stream = anthropic.messages.stream({ model: Netlify.env.get("MODELO_IA") || "claude-sonnet-5-5", max_tokens: 12000, messages: msgs });
  const enc = new TextEncoder();
  const rs = new ReadableStream({
    async start(ctrl) {
      try {
        stream.on("text", (t: string) => ctrl.enqueue(enc.encode(t)));
        await stream.finalMessage();
      } catch (e: any) {
        ctrl.enqueue(enc.encode("\n\u0000ERRO:" + String(e?.message || e)));
      }
      ctrl.close();
    },
  });
  return new Response(rs, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
};
export const config: Config = { path: "/api/ia", method: "POST" };
