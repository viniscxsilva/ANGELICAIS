"use server";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRosterOperadoresGestor } from "@/lib/d1-db/get-roster-gestor";
import { getEmailPrefix } from "@/lib/utils/email-variants";
import { getPorTema, type TemaData } from "@/lib/retencao/get-por-tema";
import {
  getQuartilOperadores,
  type OperadorQuartilItem,
} from "@/lib/retencao/get-quartil-operadores";
import { getMetaTxRetencao } from "@/lib/retencao/meta";
import {
  getIndicadoresGestor,
  listarGestoresComRoster,
} from "@/lib/retencao/comparativo/get-gestores-comparativo";
import { getMapaOperadorGestor } from "@/lib/retencao/get-mapa-operador-gestor";

/** Resumo por supervisor mostrado no card fechado da lista. */
export type SupervisorQuartilResumo = {
  /** profiles.id */
  id: string;
  nome: string;
  /** Quantos operadores do roster dele estão em Q4 do ranking da EMPRESA. */
  qtdOperadoresQ4: number;
  /** Taxa de retenção geral da equipe dele (0-1, null sem pedidos). */
  txEquipe: number | null;
  /** PEDIDOS = RETIDOS + CANCELADOS da equipe. */
  pedidosEquipe: number;
  retidosEquipe: number;
  canceladosEquipe: number;
};

type QuartilOperacaoResumo = {
  /** Meta de tx (0-100) do gestor logado, para colorir as taxas. */
  meta: number;
  /** Um item por supervisor, ordenado por qtd de operadores em Q4 (desc). */
  supervisores: SupervisorQuartilResumo[];
};

export type QuartilOperacaoResumoResult =
  | { success: true; data: QuartilOperacaoResumo }
  | { success: false; error: string };

/**
 * Nível 1 — lista de supervisores com a contagem de operadores em Q4.
 *
 * O quartil é calculado UMA vez sobre a empresa inteira
 * (`getQuartilOperadores("empresa", [])`, que reaproveita
 * compute-quartis.ts). Cada operador Q4 é atribuído ao supervisor dono dele
 * via o roster global (`getMapaOperadorGestor`).
 *
 * O detalhe de cada supervisor (operadores + retenção por tema) é carregado
 * sob demanda por `fetchQuartilOperacaoDetalheAction`.
 */
export async function fetchQuartilOperacaoAction(): Promise<QuartilOperacaoResumoResult> {
  const user = await getCurrentUser();
  if (!user || user.profile.role !== "GESTOR") {
    return { success: false, error: "Acesso não autorizado." };
  }

  try {
    const [gestores, mapaOperadorGestor, meta] = await Promise.all([
      listarGestoresComRoster(),
      getMapaOperadorGestor(),
      getMetaTxRetencao(user.profile.id),
    ]);

    // O ranking empresa-wide de quartil só considera emails cadastrados em
    // d1_operadores_gestor (união de todos os rosters). Sem isso, logins que
    // não são operadores de ninguém (ADM testando, gestor cancelando 1
    // atendimento na mão, login de outra área) entram no ranking com volume
    // ínfimo e tx ~0% e empurram operadores reais para quartis piores.
    const rankingEmpresa = await getQuartilOperadores("empresa", [], {
      loginsPermitidos: mapaOperadorGestor.keys(),
    });

    // Conta operadores em Q4 por gestor dono do operador (roster global).
    const q4PorGestor = new Map<string, number>();
    for (const op of rankingEmpresa) {
      if (op.quartil !== 4) continue;
      const gestorId = mapaOperadorGestor.get(getEmailPrefix(op.login));
      if (!gestorId) continue;
      q4PorGestor.set(gestorId, (q4PorGestor.get(gestorId) ?? 0) + 1);
    }

    // Mesma característica do comparativo: 1 varredura de retencao_atendimentos
    // por gestor para os 4 indicadores da equipe.
    const indicadores = await Promise.all(gestores.map(getIndicadoresGestor));
    const indicadorPorId = new Map(indicadores.map((i) => [i.id, i]));

    const supervisores: SupervisorQuartilResumo[] = gestores
      .map((g) => {
        const ind = indicadorPorId.get(g.id);
        return {
          id: g.id,
          nome: g.nome,
          qtdOperadoresQ4: q4PorGestor.get(g.id) ?? 0,
          txEquipe: ind?.tx ?? null,
          pedidosEquipe: ind?.pedidos ?? 0,
          retidosEquipe: ind?.retidos ?? 0,
          canceladosEquipe: ind?.cancelados ?? 0,
        };
      })
      .sort((a, b) => {
        // Supervisores com mais operadores em Q4 primeiro (precisam de suporte).
        if (b.qtdOperadoresQ4 !== a.qtdOperadoresQ4) {
          return b.qtdOperadoresQ4 - a.qtdOperadoresQ4;
        }
        return a.nome.localeCompare(b.nome, "pt-BR");
      });

    return { success: true, data: { meta, supervisores } };
  } catch (err) {
    console.error("[fetchQuartilOperacaoAction] erro:", err);
    return { success: false, error: "Erro ao carregar o quartil da operação." };
  }
}

/** Um operador em Q4 da empresa, com o breakdown de retenção por tema dele. */
export type OperadorQ4Detalhe = {
  /** Identificador REAL do operador (login/email do roster), nunca fantasia. */
  login: string;
  /** Taxa de retenção 0-1 (null sem pedidos). */
  tx: number | null;
  retidos: number;
  cancelados: number;
  /** PEDIDOS = RETIDOS + CANCELADOS. */
  pedidos: number;
  /** Posição no ranking da empresa (1 = melhor tx). */
  rank: number | null;
  /** Quantos operadores entraram no ranking da empresa. */
  totalRankeados: number;
  /** Retenção por tema (motivo normalizado) só deste operador. */
  temas: TemaData[];
};

type QuartilOperacaoDetalhe = {
  /** Meta de tx (0-100) do supervisor consultado. */
  meta: number;
  /** Operadores em Q4 do supervisor, ordenados por tx asc (pior primeiro). */
  operadores: OperadorQ4Detalhe[];
};

export type QuartilOperacaoDetalheResult =
  | { success: true; data: QuartilOperacaoDetalhe }
  | { success: false; error: string };

/**
 * Nível 2 — detalhe de um supervisor, carregado quando o card expande.
 *
 * Recalcula o ranking da empresa (mesma varredura paginada de
 * get-visao-geral/get-por-tema — aceitável, é o custo esperado), recorta os
 * operadores em Q4 que pertencem ao roster do supervisor pedido e, para cada
 * um, busca a retenção por tema individual (`getPorTema([emailDoOperador])`).
 */
export async function fetchQuartilOperacaoDetalheAction(
  gestorId: string,
): Promise<QuartilOperacaoDetalheResult> {
  const user = await getCurrentUser();
  if (!user || user.profile.role !== "GESTOR") {
    return { success: false, error: "Acesso não autorizado." };
  }

  try {
    const admin = createAdminClient();
    const { data: alvo } = await admin
      .from("profiles")
      .select("id")
      .eq("id", gestorId)
      .eq("role", "GESTOR")
      .maybeSingle();

    if (!alvo) {
      return { success: false, error: "Supervisor não encontrado." };
    }

    const [roster, meta, mapaOperadorGestor] = await Promise.all([
      getRosterOperadoresGestor(gestorId),
      getMetaTxRetencao(gestorId),
      getMapaOperadorGestor(),
    ]);

    // Mesmo recorte do nível 1: o ranking empresa-wide só considera emails
    // cadastrados em d1_operadores_gestor, para não deixar logins que não são
    // operadores (ADM, outras áreas) contaminarem os quartis. Assim o rank e
    // o Q4 mostrados aqui batem com a contagem da lista de supervisores.
    const rankingEmpresa = await getQuartilOperadores("empresa", [], {
      loginsPermitidos: mapaOperadorGestor.keys(),
    });

    const totalRankeados = rankingEmpresa.filter((op) => op.rank !== null).length;
    const rosterPrefixos = new Set(roster.map(getEmailPrefix));

    const q4DoGestor = rankingEmpresa.filter(
      (op) => op.quartil === 4 && rosterPrefixos.has(getEmailPrefix(op.login)),
    );

    const operadores: OperadorQ4Detalhe[] = await Promise.all(
      q4DoGestor.map(async (op: OperadorQuartilItem) => ({
        login: op.login,
        tx: op.tx,
        retidos: op.retidos,
        cancelados: op.cancelados,
        pedidos: op.retidos + op.cancelados,
        rank: op.rank,
        totalRankeados,
        temas: await getPorTema([op.login]),
      })),
    );

    operadores.sort((a, b) => {
      if (a.tx === null && b.tx === null) return a.login.localeCompare(b.login);
      if (a.tx === null) return 1;
      if (b.tx === null) return -1;
      return a.tx - b.tx; // pior tx primeiro
    });

    return { success: true, data: { meta, operadores } };
  } catch (err) {
    console.error("[fetchQuartilOperacaoDetalheAction] erro:", err);
    return { success: false, error: "Erro ao carregar o detalhe do supervisor." };
  }
}
