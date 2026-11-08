// banco de documentos JSON (coleção/id) no Cloudflare D1 — mesma API da versão Netlify
import { Env, autorizado, negado, prepara, semBanco, avisoBanco } from "../_lib/auth";
const ok = (p: string, par: boolean) => { const seg = p.split("/"); return seg.length >= 1 && seg.every((s) => /^[A-Za-z0-9_\-.]{1,120}$/.test(s)) && (seg.length % 2 === 0) === par; };
const colDe = (doc: string) => doc.split("/").slice(0, -1).join("/");
export const onRequest: PagesFunction<Env> = async ({ request: req, env }) => {
  if (semBanco(env)) return avisoBanco();
  if (!(await autorizado(req, env))) return negado();
  await prepara(env);
  const u = new URL(req.url);
  const col = u.searchParams.get("col"), doc = u.searchParams.get("doc");
  if (col && req.method === "GET") {
    if (!ok(col, false)) return Response.json({ erro: "coleção inválida" }, { status: 400 });
    const { results } = await env.DB.prepare("SELECT k, v FROM docs WHERE col = ?").bind(col).all<{ k: string; v: string }>();
    return Response.json((results || []).map((r) => ({ id: r.k.slice(col.length + 1), data: JSON.parse(r.v) })).filter((d) => d.data != null));
  }
  if (doc) {
    if (!ok(doc, true)) return Response.json({ erro: "documento inválido" }, { status: 400 });
    if (req.method === "GET") { const r = await env.DB.prepare("SELECT v FROM docs WHERE k = ?").bind(doc).first<{ v: string }>(); return Response.json({ data: r ? JSON.parse(r.v) : null }); }
    if (req.method === "PUT") {
      const txt = await req.text(); JSON.parse(txt);
      await env.DB.prepare("INSERT INTO docs (k,col,v) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(doc, colDe(doc), txt).run();
      return Response.json({ ok: true });
    }
    if (req.method === "DELETE") { await env.DB.prepare("DELETE FROM docs WHERE k = ?").bind(doc).run(); return Response.json({ ok: true }); }
  }
  return Response.json({ erro: "pedido inválido" }, { status: 400 });
};
