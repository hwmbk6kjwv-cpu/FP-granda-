// arquivos dos pedidos (PDF original, modelo 3D, estado de cada item) no Cloudflare KV
import { Env, autorizado, negado, semBanco, avisoBanco } from "./auth";
export async function arquivo(req: Request, env: Env, idParam?: string) {
  if (semBanco(env)) return avisoBanco();
  if (!(await autorizado(req, env))) return negado();
  const id = idParam || new URL(req.url).searchParams.get("id") || "";
  if (req.method === "POST") {
    const novo = crypto.randomUUID(), tipo = req.headers.get("content-type") || "application/octet-stream", buf = await req.arrayBuffer();
    if (buf.byteLength > 24 * 1024 * 1024) return Response.json({ erro: "arquivo maior que 24 MB" }, { status: 413 });
    await env.ARQ.put(novo, buf, { metadata: { tipo, tamanho: buf.byteLength, criado: Date.now() } });
    return Response.json({ id: novo, url: "/_blob/" + novo, sizeBytes: buf.byteLength, contentType: tipo });
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ erro: "id inválido" }, { status: 400 });
  if (req.method === "DELETE") { await env.ARQ.delete(id); return Response.json({ ok: true }); }
  const e = await env.ARQ.getWithMetadata<{ tipo?: string }>(id, "arrayBuffer");
  if (e.value === null) return new Response("não encontrado", { status: 404 });
  return new Response(e.value, { headers: { "content-type": String(e.metadata?.tipo || "application/octet-stream") } });
}
