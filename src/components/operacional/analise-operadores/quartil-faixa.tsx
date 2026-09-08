import type { CSSProperties } from "react";

import { foraDeOperacao } from "@/lib/kpi/analise-operadores/meta-status";
import type { PontoSerie } from "@/lib/kpi/analise-operadores/serial-types";

export type QuartilNivel = 1 | 2 | 3 | 4;

/**
 * Faixa de quartil que acompanha o gráfico de um KPI principal: um marcador
 * por mês (Q1 = melhor desempenho relativo … Q4 = pior), contra TODOS os
 * operadores da empresa. Só a posição do operador — nunca nomes/valores de
 * terceiros.
 *
 * 4 cores ordenadas e distintas: Q1 verde · Q2 amarelo · Q3 laranja · Q4
 * vermelho. Não há token global de "laranja" — é derivado localmente com
 * `color-mix(--warning, --danger)` (fica coerente em claro e escuro, sem
 * mexer em globals.css). `var()`/`color-mix` inline aqui é seguro: HTML
 * normal, o modern-screenshot resolve na captura (mesmo padrão do StyledCard).
 */
const LARANJA = "color-mix(in oklch, var(--warning), var(--danger))";

export const ESTILO_POR_NIVEL: Record<
  QuartilNivel,
  { bg: string; fg: string; bd: string }
> = {
  1: {
    bg: "var(--success-bg)",
    fg: "var(--success)",
    bd: "var(--success-border)",
  },
  2: {
    bg: "var(--warning-bg)",
    fg: "var(--warning)",
    bd: "var(--warning-border)",
  },
  3: {
    bg: `color-mix(in srgb, ${LARANJA} 15%, transparent)`,
    fg: LARANJA,
    bd: `color-mix(in srgb, ${LARANJA} 38%, transparent)`,
  },
  4: {
    bg: "var(--danger-bg)",
    fg: "var(--danger)",
    bd: "var(--danger-border)",
  },
};

/**
 * Selo compacto de um único quartil (Q1 verde … Q4 vermelho), com as MESMAS
 * cores/tokens da faixa acima — fonte única de verdade em `ESTILO_POR_NIVEL`.
 * Usado fora do gráfico mensal (ex.: /operacao/quartil) para marcar o
 * operador sem redefinir a paleta.
 */
export function QuartilBadge({
  nivel,
  className = "",
}: {
  nivel: QuartilNivel;
  className?: string;
}) {
  const estilo = ESTILO_POR_NIVEL[nivel];
  return (
    <span
      className={`ds-mono-sm inline-flex h-6 items-center justify-center rounded border px-2 text-[11px] font-semibold tabular-nums ${className}`}
      style={{
        backgroundColor: estilo.bg,
        color: estilo.fg,
        borderColor: estilo.bd,
      }}
    >
      Q{nivel}
    </span>
  );
}

export function QuartilFaixa({ pontos }: { pontos: PontoSerie[] }) {
  return (
    <div className="space-y-1">
      <p className="ds-mono-sm text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Quartil no mês (Q1 melhor · Q4 pior) — vs. toda a empresa
      </p>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${pontos.length}, minmax(0, 1fr))` }}
      >
        {pontos.map((p) => {
          const nivel = p.quartil;
          const estilo = nivel ? ESTILO_POR_NIVEL[nivel] : null;
          const fora = foraDeOperacao(p.statusOperador);
          const textoFora = p.metaStatusRotulo;

          const cellStyle: CSSProperties = estilo
            ? {
                backgroundColor: estilo.bg,
                color: estilo.fg,
                borderColor: estilo.bd,
              }
            : fora
              ? {
                  backgroundColor: "var(--warning-bg)",
                  color: "var(--warning)",
                  borderColor: "var(--warning-border)",
                }
              : {
                  backgroundColor: "transparent",
                  color: "var(--muted-foreground)",
                  borderColor: "var(--border)",
                };

          return (
            <div
              key={p.mesRef}
              className="flex flex-col items-center gap-0.5"
              title={
                nivel
                  ? `${p.label}: Q${nivel}`
                  : fora
                    ? `${p.label}: fora de operação (${textoFora ?? "afastado"})`
                    : `${p.label}: sem quartil (KPI não ranqueável ou sem valor)`
              }
            >
              <div
                className="ds-mono-sm flex h-6 w-full items-center justify-center rounded border text-[11px] font-semibold tabular-nums"
                style={cellStyle}
              >
                {nivel ? `Q${nivel}` : fora ? "•" : "—"}
              </div>
              <span className="text-muted-foreground text-[9px] tabular-nums">
                {p.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
