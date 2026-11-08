// "Montar 3D" da estrutura por desenho: chama a API da Anthropic (precisa da variável secreta ANTHROPIC_API_KEY) e devolve o texto em streaming
import { Env, autorizado, negado } from "../_lib/auth";
export const onRequest: PagesFunction<Env> = async ({ request: req, env }) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  if (!(await autorizado(req, env))) return negado();
  if (!env.ANTHROPIC_API_KEY) return Response.json({ erro: "IA ainda não está ativa neste site (falta a chave ANTHROPIC_API_KEY)" }, { status: 503 });
  const body: any = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.messages) || !body.messages.length) return Response.json({ erro: "pedido inválido" }, { status: 400 });
  const msgs = body.messages.slice(-12).map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") as any }));
  const imgs: any[] = Array.isArray(body.images) ? body.images.slice(0, 2) : [];
  if (imgs.length) { const last = msgs[msgs.length - 1]; last.content = [...imgs.map((im) => ({ type: "image", source: { type: "base64", media_type: im.media_type || "image/png", data: im.data } })), { type: "text", text: last.content }]; }
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: env.MODELO_IA || "claude-sonnet-5-5", max_tokens: 12000, stream: true, messages: msgs }) });
  const enc = new TextEncoder(), dec = new TextDecoder();
  if (!r.ok || !r.body) return new Response("\u0000ERRO:" + (await r.text()), { headers: { "content-type": "text/plain; charset=utf-8" } });
  const reader = r.body.getReader();
  const rs = new ReadableStream({ async start(ctrl) { let buf = "";
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i;
        while ((i = buf.indexOf("\n")) >= 0) { const ln = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!ln.startsWith("data:")) continue;
          try { const ev = JSON.parse(ln.slice(5)); if (ev.type === "content_block_delta" && ev.delta?.text) ctrl.enqueue(enc.encode(ev.delta.text)); if (ev.type === "error") ctrl.enqueue(enc.encode("\n\u0000ERRO:" + (ev.error?.message || "erro"))); } catch {} } } }
    catch (e: any) { ctrl.enqueue(enc.encode("\n\u0000ERRO:" + String(e?.message || e))) }
    ctrl.close(); } });
  return new Response(rs, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
};
