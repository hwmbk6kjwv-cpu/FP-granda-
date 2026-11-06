import type { Config } from "@netlify/functions";
import { autorizado, senhaConfere, token, cookie, trocaSenha } from "../lib/auth.mts";

export default async (req: Request) => {
  if (req.method === "GET") {
    const ok = await autorizado(req);
    return Response.json({ ok }, { status: ok ? 200 : 401 });
  }
  if (req.method === "DELETE") return new Response(null, { status: 204, headers: { "set-cookie": cookie("", 0) } });
  const body = await req.json().catch(() => ({} as any));
  // troca de senha: precisa estar logado e informar a senha atual
  if (body.nova !== undefined) {
    if (!(await autorizado(req)) || !(await senhaConfere(body.atual))) return Response.json({ ok: false, erro: "senha atual incorreta" }, { status: 401 });
    if (String(body.nova).length < 6) return Response.json({ ok: false, erro: "a nova senha precisa de pelo menos 6 caracteres" }, { status: 400 });
    await trocaSenha(String(body.nova));
    return Response.json({ ok: true }, { headers: { "set-cookie": cookie(await token(), 60 * 60 * 24 * 30) } });
  }
  if (!(await senhaConfere(body.senha))) {
    await new Promise((r) => setTimeout(r, 800)); // freia tentativa e erro
    return Response.json({ ok: false, erro: "senha incorreta" }, { status: 401 });
  }
  return Response.json({ ok: true }, { headers: { "set-cookie": cookie(await token(), 60 * 60 * 24 * 30) } });
};
export const config: Config = { path: "/api/login", method: ["GET", "POST", "DELETE"] };
