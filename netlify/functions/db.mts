// banco de dados simples em documentos JSON (coleção/id), guardado no Netlify Blobs
import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { autorizado, negado } from "../lib/auth.mts";

const ok = (p: string, par: boolean) => {
  const seg = p.split("/");
  return seg.length >= 1 && seg.every((s) => /^[A-Za-z0-9_\-.]{1,120}$/.test(s)) && (seg.length % 2 === 0) === par;
};

export default async (req: Request) => {
  if (!(await autorizado(req))) return negado();
  const u = new URL(req.url);
  const st = getStore({ name: "granda-db", consistency: "strong" });
  const col = u.searchParams.get("col");
  const doc = u.searchParams.get("doc");
  if (col && req.method === "GET") {
    if (!ok(col, false)) return Response.json({ erro: "coleção inválida" }, { status: 400 });
    const { blobs } = await st.list({ prefix: col + "/" });
    const keys = blobs.map((b) => b.key).filter((k) => !k.slice(col.length + 1).includes("/"));
    const docs = await Promise.all(keys.map(async (k) => ({ id: k.slice(col.length + 1), data: await st.get(k, { type: "json" }) })));
    return Response.json(docs.filter((d) => d.data != null));
  }
  if (doc) {
    if (!ok(doc, true)) return Response.json({ erro: "documento inválido" }, { status: 400 });
    if (req.method === "GET") return Response.json({ data: await st.get(doc, { type: "json" }) });
    if (req.method === "PUT") {
      const data = await req.json();
      await st.setJSON(doc, data);
      return Response.json({ ok: true });
    }
    if (req.method === "DELETE") {
      await st.delete(doc);
      return Response.json({ ok: true });
    }
  }
  return Response.json({ erro: "pedido inválido" }, { status: 400 });
};
export const config: Config = { path: "/api/db", method: ["GET", "PUT", "DELETE"] };
