// arquivos salvos dos pedidos (PDF original, modelo 3D, estado de cada item)
import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { autorizado, negado } from "../lib/auth.mts";

export default async (req: Request, context: Context) => {
  if (!(await autorizado(req))) return negado();
  const st = getStore({ name: "granda-arquivos", consistency: "strong" });
  const id = context.params.id || new URL(req.url).searchParams.get("id") || "";
  if (req.method === "POST") {
    const novo = crypto.randomUUID();
    const tipo = req.headers.get("content-type") || "application/octet-stream";
    const buf = await req.arrayBuffer();
    await st.set(novo, buf, { metadata: { tipo, tamanho: buf.byteLength, criado: Date.now() } });
    return Response.json({ id: novo, url: "/_blob/" + novo, sizeBytes: buf.byteLength, contentType: tipo });
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ erro: "id inválido" }, { status: 400 });
  if (req.method === "DELETE") {
    await st.delete(id);
    return Response.json({ ok: true });
  }
  const e = await st.getWithMetadata(id, { type: "arrayBuffer" });
  if (e === null) return new Response("não encontrado", { status: 404 });
  return new Response(e.data as ArrayBuffer, { headers: { "content-type": String((e.metadata as any)?.tipo || "application/octet-stream") } });
};
export const config: Config = { path: ["/api/arquivo", "/_blob/:id"], method: ["GET", "POST", "DELETE"] };
