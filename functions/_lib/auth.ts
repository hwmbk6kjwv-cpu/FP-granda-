// Cloudflare Pages Functions — senha única da Granda (mesmo comportamento da versão Netlify).
// Hash PBKDF2-SHA256 (WebCrypto). O cookie de sessão é um HMAC do hash: trocar a senha derruba as sessões antigas.
export interface Env { DB: D1Database; ARQ: KVNamespace; ANTHROPIC_API_KEY?: string; MODELO_IA?: string }
const COOKIE = "granda_auth";
const HASH_INICIAL = "ea4ddf8fd64defc262880742e71a4c65:3a15fc3a62d31640c72d6b65d67fb953cb56cd000dccd0519c116ba1e5cd290a";
const te = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => new Uint8Array(s.match(/../g)!.map((h) => parseInt(h, 16)));

export async function prepara(env: Env) {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS docs (k TEXT PRIMARY KEY, col TEXT, v TEXT)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS docs_col ON docs(col)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS cfg (k TEXT PRIMARY KEY, v TEXT)"),
  ]);
}
async function hashAtual(env: Env): Promise<string> {
  await prepara(env);
  const r = await env.DB.prepare("SELECT v FROM cfg WHERE k='senha'").first<{ v: string }>();
  return (r && r.v) || HASH_INICIAL;
}
async function pbkdf2(senha: string, salt: string) {
  const k = await crypto.subtle.importKey("raw", te.encode(senha), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(salt), iterations: 100000 }, k, 256));
}
const igual = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
export async function senhaConfere(env: Env, senha: string) {
  const [salt, h] = (await hashAtual(env)).split(":");
  return igual(await pbkdf2(String(senha || ""), salt), h);
}
export async function trocaSenha(env: Env, nova: string) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  await env.DB.prepare("INSERT INTO cfg (k,v) VALUES ('senha',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(salt + ":" + (await pbkdf2(nova, salt))).run();
}
export async function token(env: Env) {
  const k = await crypto.subtle.importKey("raw", te.encode(await hashAtual(env)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, te.encode("granda-ajustes-v1")));
}
export async function autorizado(req: Request, env: Env) {
  const c = (req.headers.get("cookie") || "").split(/;\s*/).find((x) => x.startsWith(COOKIE + "="));
  if (!c) return false;
  return igual(c.slice(COOKIE.length + 1), await token(env));
}
export const cookie = (valor: string, maxAge: number) => `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
export const negado = () => Response.json({ erro: "acesso negado" }, { status: 401 });
export const semBanco = (env: Env) => !env.DB || !env.ARQ;
export const avisoBanco = () => Response.json({ erro: "Banco não ligado: crie o D1 (variável DB) e o KV (variável ARQ) em Settings > Bindings" }, { status: 503 });

// troca de senha liberada pelo painel do Cloudflare: no console do D1 rodar  INSERT OR REPLACE INTO cfg (k,v) VALUES ('senha_nova','1');
export async function pedeSenhaNova(env: Env) { await prepara(env); const r = await env.DB.prepare("SELECT v FROM cfg WHERE k='senha_nova'").first<{ v: string }>(); return !!(r && r.v === "1"); }
export async function limpaPedido(env: Env) { await env.DB.prepare("DELETE FROM cfg WHERE k='senha_nova'").run(); }
