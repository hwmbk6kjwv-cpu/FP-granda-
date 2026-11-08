import { Env } from "../_lib/auth";
import { arquivo } from "../_lib/arquivo";
export const onRequest: PagesFunction<Env> = ({ request, env }) => arquivo(request, env);
