"use client";

import { useMemo, useState } from "react";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";

import { StyledCard } from "@/components/gestor/styled-card";
import type { OperadorQ4Detalhe } from "@/lib/retencao/quartil-operacao/actions";

interface OperadorQ4CardProps {
  operador: OperadorQ4Detalhe;
  /** Meta de tx (0-100) do supervisor, para colorir as taxas. */
  meta: number;
}

/**
 * Card de um operador em Q4 da empresa dentro do supervisor expandido.
 *
 * Mesmas métricas da tabela de distribuicao-quartis.tsx (Operador · Pedidos ·
 * Retidos · Cancelados · Tx Retenção), em formato de card, com uma mini-tabela
 * de retenção por tema individual (pior tx primeiro). Não repete o selo "Q4":
 * todo operador listado aqui já é Q4 por definição (é o filtro da página).
 *
 * O operador é sempre identificado pelo login/email REAL — nunca nome
 * fantasia, igual /operacao/comparativo-consolidado.
 *
 * A tabela "Retenção por tema" começa fechada e cada card abre/fecha de
 * forma independente (estado local, sem Radix) — com 6+ operadores manter
 * todas abertas de uma vez polui a tela. O resumo (métricas + rank) fica
 * sempre visível. Mesma mecânica de toggle de linha-gestor-comparativo.tsx.
 */
export function OperadorQ4Card({ operador, meta }: OperadorQ4CardProps) {
  const {
    login,
    tx,
    retidos,
    cancelados,
    pedidos,
    rank,
    totalRankeados,
    temas,
  } = operador;

  const [aberto, setAberto] = useState(false);

  const metaFracao = meta / 100;
  const displayName = login.includes("@") ? login.split("@")[0] : login;

  const txFormatted = tx !== null ? `${(tx * 100).toFixed(1)}%` : "—";
  const txColor =
    tx === null || tx < metaFracao
      ? "text-danger font-medium"
      : "text-success font-medium";

  // Pior tx primeiro — mesma convenção de get-por-tema (submotivos por tx ASC).
  const temasOrdenados = useMemo(() => {
    return [...temas].sort((a, b) => {
      if (a.tx === null && b.tx === null) return 0;
      if (a.tx === null) return 1;
      if (b.tx === null) return -1;
      return a.tx - b.tx;
    });
  }, [temas]);

  const metricas: { label: string; valor: string; classe: string }[] = [
    {
      label: "Pedidos",
      valor: pedidos.toLocaleString("pt-BR"),
      classe: "text-foreground",
    },
    {
      label: "Retidos",
      valor: retidos.toLocaleString("pt-BR"),
      classe: "text-foreground",
    },
    {
      label: "Cancelados",
      valor: cancelados.toLocaleString("pt-BR"),
      classe: "text-foreground",
    },
    { label: "Tx Retenção", valor: txFormatted, classe: txColor },
  ];

  return (
    <StyledCard className="p-4 space-y-4" withGradient corners="left">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="w-full space-y-4 text-left cursor-pointer"
      >
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border/40 pb-3">
          <span className="text-muted-foreground/60">
            {aberto ? (
              <IconChevronDown size={16} />
            ) : (
              <IconChevronRight size={16} />
            )}
          </span>
          <span className="ds-body text-sm font-semibold text-foreground truncate">
            {displayName}
          </span>
          {rank !== null && (
            <span className="ds-mono-sm text-muted-foreground text-[11px] tabular-nums">
              {rank}/{totalRankeados} na empresa
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metricas.map((m) => (
            <div key={m.label} className="flex flex-col">
              <span className="ds-small text-muted-foreground/80 text-[10px] font-semibold uppercase tracking-wider">
                {m.label}
              </span>
              <span className={`ds-body text-sm font-semibold ${m.classe}`}>
                {m.valor}
              </span>
            </div>
          ))}
        </div>
      </button>

      {aberto && (
        <div className="space-y-2">
          <h4 className="ds-mono-sm text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
            Retenção por tema
          </h4>
          <div className="overflow-x-auto scrollbar-tema">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="ds-mono-sm text-muted-foreground uppercase tracking-wider text-[11px] select-none border-b border-border/40 bg-muted/40">
                  <th className="py-2 px-3 font-semibold whitespace-nowrap">
                    Tema
                  </th>
                  <th className="py-2 px-3 font-semibold text-center w-[90px] whitespace-nowrap">
                    Pedidos
                  </th>
                  <th className="py-2 px-3 font-semibold text-center w-[90px] whitespace-nowrap">
                    Retidos
                  </th>
                  <th className="py-2 px-3 font-semibold text-center w-[90px] whitespace-nowrap">
                    Cancelados
                  </th>
                  <th className="py-2 px-3 font-semibold text-center w-[110px] whitespace-nowrap">
                    Tx Retenção
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {temasOrdenados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-4 px-3 text-center ds-small text-muted-foreground"
                    >
                      Sem atendimentos classificados por tema.
                    </td>
                  </tr>
                ) : (
                  temasOrdenados.map((t) => {
                    const tTxFormatted =
                      t.tx !== null ? `${(t.tx * 100).toFixed(1)}%` : "—";
                    const tTxColor =
                      t.tx === null || t.tx < metaFracao
                        ? "text-danger font-medium"
                        : "text-success font-medium";
                    return (
                      <tr
                        key={t.motivo}
                        className="hover:bg-muted/10 transition-colors"
                      >
                        <td className="py-2.5 px-3 text-xs font-semibold text-foreground whitespace-nowrap">
                          {t.motivo}
                        </td>
                        <td className="py-2.5 px-3 text-center text-xs font-medium text-foreground">
                          {t.total.toLocaleString("pt-BR")}
                        </td>
                        <td className="py-2.5 px-3 text-center text-xs font-medium text-foreground">
                          {t.retidos.toLocaleString("pt-BR")}
                        </td>
                        <td className="py-2.5 px-3 text-center text-xs font-medium text-foreground">
                          {t.cancelados.toLocaleString("pt-BR")}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-center text-xs font-semibold ${tTxColor}`}
                        >
                          {tTxFormatted}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </StyledCard>
  );
}
