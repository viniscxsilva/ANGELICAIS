import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailPrefix } from "@/lib/utils/email-variants";

/**
 * Mapa "prefixo do email do operador → gestor_id dono do roster", montado a
 * partir de TODAS as linhas de d1_operadores_gestor (a operação inteira, não
 * só a equipe do gestor logado).
 *
 * Cada operador é dono de um único gestor (rosters disjuntos — ver
 * get-gestores-comparativo.ts), então este mapa é uma partição direta da
 * base de operadores.
 *
 * Chaveado por PREFIXO (getEmailPrefix) — o roster guarda @alloha.com, mas a
 * base de retenção pode trazer o mesmo operador sob @sumicity.net.br.
 */
export async function getMapaOperadorGestor(): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("d1_operadores_gestor")
    .select("operador_email, gestor_id");

  if (error) {
    console.error(
      "[getMapaOperadorGestor] erro ao buscar roster global:",
      error.message,
    );
    return new Map();
  }

  const mapa = new Map<string, string>();
  for (const row of data ?? []) {
    if (!row.operador_email || !row.gestor_id) continue;
    mapa.set(getEmailPrefix(row.operador_email), row.gestor_id as string);
  }
  return mapa;
}
