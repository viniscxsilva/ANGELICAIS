import { getPorOperador } from "./get-por-operador";
import { computeQuartis, type OperadorParaQuartil } from "@/lib/kpi/gestor/compute-quartis";
import type { KpiDefinition } from "@/lib/kpi/types";
import { getEmailPrefix } from "@/lib/utils/email-variants";

type GetQuartilOperadoresOpcoes = {
  /**
   * Allowlist opcional de logins/emails que podem entrar no cálculo de
   * quartil. Quando informada, qualquer operador cujo login (comparado por
   * PREFIXO, sem domínio) não esteja no conjunto fica FORA do ranking
   * (retorna com quartil/rank null), mas continua na lista de retorno.
   *
   * Motivo: em `retencao_atendimentos` aparecem logins que não são
   * operadores cadastrados de nenhum gestor (ADM testando, gestor cancelando
   * 1 atendimento na mão, login de outra área). Eles entram com volume
   * baixíssimo e tx ~0%, contaminando o ranking empresa-wide e empurrando
   * operadores reais para quartis piores. A página /operacao/quartil passa
   * aqui a união de todos os rosters de `d1_operadores_gestor`.
   *
   * Sem esta opção o comportamento é o de sempre (todo login ranqueia) — as
   * demais telas que usam esta função não mudam.
   */
  loginsPermitidos?: Iterable<string>;
};

export type OperadorQuartilItem = {
  login: string;
  nome: string;
  total: number;
  retidos: number;
  cancelados: number;
  tx: number | null;
  quartil: 1 | 2 | 3 | 4 | null;
  rank: number | null;
};

// Volume mínimo de atendimentos para ranquear o operador no quartil
const QUARTIL_VOLUME_MINIMO = 0;

/**
 * Retorna os operadores do escopo com seus respectivos ranks e quartis baseados na taxa de retenção.
 * 
 * Reusa a função pura computeQuartis do módulo de KPIs da plataforma.
 */
export async function getQuartilOperadores(
  escopo: "equipe" | "empresa",
  emailsEquipe: string[],
  opcoes: GetQuartilOperadoresOpcoes = {},
): Promise<OperadorQuartilItem[]> {
  const operadores = await getPorOperador(escopo, emailsEquipe);

  // Allowlist opcional por prefixo de email (ver GetQuartilOperadoresOpcoes).
  const prefixosPermitidos = opcoes.loginsPermitidos
    ? new Set([...opcoes.loginsPermitidos].map(getEmailPrefix))
    : null;
  const permitido = (login: string) =>
    prefixosPermitidos === null || prefixosPermitidos.has(getEmailPrefix(login));

  // Filtra apenas operadores que atingiram o volume mínimo e estão na
  // allowlist (quando informada).
  const qualificados = operadores.filter(
    (op) => op.total >= QUARTIL_VOLUME_MINIMO && permitido(op.login),
  );

  const listParaQuartil: OperadorParaQuartil[] = qualificados.map((op) => {
    const valoresMap = new Map<string, number | null>();
    valoresMap.set("tx_retencao", op.tx);
    return {
      email: op.login,
      valores: valoresMap,
    };
  });

  // Mock de definição de KPI exigido pela função computeQuartis
  const mockDefinitions = [
    {
      slug: "tx_retencao",
      direction: "higher_better",
    },
  ];

  const resultQuartis = computeQuartis(listParaQuartil, mockDefinitions as unknown as KpiDefinition[]);

  return operadores.map((op) => {
    const qual = op.total >= QUARTIL_VOLUME_MINIMO && permitido(op.login);
    let quartil: 1 | 2 | 3 | 4 | null = null;
    let rank: number | null = null;

    if (qual) {
      const qRes = resultQuartis.get(op.login)?.get("tx_retencao");
      if (qRes) {
        quartil = qRes.quartil;
        rank = qRes.rank;
      }
    }

    return {
      login: op.login,
      nome: op.nome,
      total: op.total,
      retidos: op.retidos,
      cancelados: op.cancelados,
      tx: op.tx,
      quartil,
      rank,
    };
  });
}
