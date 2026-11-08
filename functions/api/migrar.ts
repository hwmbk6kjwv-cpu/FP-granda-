// cópia única dos dados do site antigo (Netlify) para este (Cloudflare). Precisa estar logado aqui.
// POST {senha, etapa:"docs"} → copia coleções/documentos e devolve os ids dos arquivos
// POST {senha, etapa:"arq", id} → copia um arquivo (mantém o mesmo id)
import { Env, autorizado, negado, prepara, semBanco, avisoBanco } from "../_lib/auth";
const ORIGEM = "https://fpgranda.netlify.app";
const COLS = ["pedidos", "tipos", "fixacoes"], DOCS = ["config/acm", "config/empresa", "config/perfis", "config/ancoragens"];
async function entrar(senha: string) {
  const r = await fetch(ORIGEM + "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ senha }) });
  const c = (r.headers.get("set-cookie") || "").split(";")[0];
  if (!r.ok || !c) throw new Error("senha do site antigo incorreta");
  return c;
}
export const onRequest: PagesFunction<Env> = async ({ request: req, env }) => {
  if (semBanco(env)) return avisoBanco();
  if (req.method !== "POST") return new Response(null, { status: 405 });
  if (!(await autorizado(req, env))) return negado();
  await prepara(env);
  const b: any = await req.json().catch(() => ({}));
  try {
    const ck = await entrar(String(b.senha || ""));
    const get = (p: string) => fetch(ORIGEM + p, { headers: { cookie: ck } });
    if (b.etapa === "docs") {
      const st: any[] = [], ids = new Set<string>(); let n = 0;
      for (const col of COLS) {
        const r = await get("/api/db?col=" + col); if (!r.ok) continue; const txt = await r.text();
        (txt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) || []).forEach((x) => ids.add(x));
        for (const d of JSON.parse(txt)) { st.push(env.DB.prepare("INSERT INTO docs (k,col,v) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(col + "/" + d.id, col, JSON.stringify(d.data))); n++ }
      }
      for (const doc of DOCS) {
        const r = await get("/api/db?doc=" + doc); if (!r.ok) continue; const j: any = await r.json(); if (j.data == null) continue;
        const txt = JSON.stringify(j.data); (txt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) || []).forEach((x) => ids.add(x));
        st.push(env.DB.prepare("INSERT INTO docs (k,col,v) VALUES (?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(doc, doc.split("/")[0], txt)); n++;
      }
      for (let i = 0; i < st.length; i += 50) await env.DB.batch(st.slice(i, i + 50));
      return Response.json({ ok: true, documentos: n, arquivos: [...ids] });
    }
    if (b.etapa === "arq") {
      const id = String(b.id || ""); if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ erro: "id inválido" }, { status: 400 });
      const ja = await env.ARQ.getWithMetadata(id, "stream"); if (ja.value) return Response.json({ ok: true, ja: true });
      const r = await get("/_blob/" + id); if (!r.ok) return Response.json({ ok: false, status: r.status });
      const buf = await r.arrayBuffer(); const tipo = r.headers.get("content-type") || "application/octet-stream";
      await env.ARQ.put(id, buf, { metadata: { tipo, tamanho: buf.byteLength, criado: Date.now() } });
      return Response.json({ ok: true, tamanho: buf.byteLength });
    }
    return Response.json({ erro: "etapa inválida" }, { status: 400 });
  } catch (e: any) { return Response.json({ ok: false, erro: String(e?.message || e) }, { status: 400 }) }
};
