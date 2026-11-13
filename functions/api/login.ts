import { Env, autorizado, senhaConfere, token, cookie, trocaSenha, semBanco, avisoBanco, pedeSenhaNova, limpaPedido } from "../_lib/auth";
export const onRequest: PagesFunction<Env> = async ({ request: req, env }) => {
  if (semBanco(env)) return avisoBanco();
  if (req.method === "GET") { const ok = await autorizado(req, env); return Response.json({ ok, definir: !ok && (await pedeSenhaNova(env)) }, { status: ok ? 200 : 401 }); }
  if (req.method === "DELETE") return new Response(null, { status: 204, headers: { "set-cookie": cookie("", 0) } });
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const body: any = await req.json().catch(() => ({}));
  if (body.nova !== undefined) {
    if (!(await autorizado(req, env)) || !(await senhaConfere(env, body.atual))) return Response.json({ ok: false, erro: "senha atual incorreta" }, { status: 401 });
    if (String(body.nova).length < 6) return Response.json({ ok: false, erro: "a nova senha precisa de pelo menos 6 caracteres" }, { status: 400 });
    await trocaSenha(env, String(body.nova));
    return Response.json({ ok: true }, { headers: { "set-cookie": cookie(await token(env), 60 * 60 * 24 * 30) } });
  }
  // troca liberada pelo painel do Cloudflare (cfg 'senha_nova'='1'): a primeira senha enviada vira a senha nova
  if (body.definir && (await pedeSenhaNova(env))) {
    if (String(body.senha || "").length < 6) return Response.json({ ok: false, erro: "a senha precisa de pelo menos 6 caracteres" }, { status: 400 });
    await trocaSenha(env, String(body.senha)); await limpaPedido(env);
    return Response.json({ ok: true }, { headers: { "set-cookie": cookie(await token(env), 60 * 60 * 24 * 30) } });
  }
  if (!(await senhaConfere(env, body.senha))) { await new Promise((r) => setTimeout(r, 800)); return Response.json({ ok: false, erro: "senha incorreta" }, { status: 401 }); }
  return Response.json({ ok: true }, { headers: { "set-cookie": cookie(await token(env), 60 * 60 * 24 * 30) } });
};
