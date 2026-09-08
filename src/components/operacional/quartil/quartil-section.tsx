"use client";

import { useState } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";

import {
  fetchQuartilOperacaoDetalheAction,
  type QuartilOperacaoDetalheResult,
  type SupervisorQuartilResumo,
} from "@/lib/retencao/quartil-operacao/actions";

import { LinhaSupervisorQuartil } from "./linha-supervisor-quartil";
import { OperadorQ4Card } from "./operador-q4-card";

type Detalhe = NonNullable<
  Extract<QuartilOperacaoDetalheResult, { success: true }>["data"]
>;

interface QuartilSectionProps {
  /** Meta de tx (0-100) do gestor logado, para colorir as taxas do resumo. */
  meta: number;
  supervisores: SupervisorQuartilResumo[];
}

export function QuartilSection({ meta, supervisores }: QuartilSectionProps) {
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [carregandoId, setCarregandoId] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<Record<string, Detalhe>>({});

  async function toggle(gestorId: string) {
    if (abertoId === gestorId) {
      setAbertoId(null);
      return;
    }

    setAbertoId(gestorId);

    if (detalhes[gestorId]) return;

    setCarregandoId(gestorId);
    try {
      const res = await fetchQuartilOperacaoDetalheAction(gestorId);
      if (res.success) {
        setDetalhes((prev) => ({ ...prev, [gestorId]: res.data }));
      } else {
        toast.error(res.error);
        setAbertoId((cur) => (cur === gestorId ? null : cur));
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar o detalhe do supervisor.");
      setAbertoId((cur) => (cur === gestorId ? null : cur));
    } finally {
      setCarregandoId((cur) => (cur === gestorId ? null : cur));
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="ds-h3 font-semibold text-foreground">
            Operadores em Q4 por supervisor
          </h2>
          <p className="ds-small text-muted-foreground mt-1">
            Abra um supervisor para ver os operadores dele que estão no pior
            quartil (Q4) da empresa inteira, com a retenção por tema de cada um.
          </p>
        </div>

        <div className="space-y-3">
          {supervisores.map((s) => {
            const detalhe = detalhes[s.id];
            return (
              <LinhaSupervisorQuartil
                key={s.id}
                resumo={s}
                meta={meta}
                aberto={abertoId === s.id}
                carregando={carregandoId === s.id}
                onToggle={() => toggle(s.id)}
              >
                {detalhe ? (
                  detalhe.operadores.length === 0 ? (
                    <p className="ds-small text-muted-foreground py-6 text-center">
                      Nenhum operador deste supervisor está em Q4 da empresa.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {detalhe.operadores.map((op) => (
                        <OperadorQ4Card
                          key={op.login}
                          operador={op}
                          meta={detalhe.meta}
                        />
                      ))}
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                    <IconLoader2 size={18} className="animate-spin" />
                    <span className="ds-small">Carregando detalhe…</span>
                  </div>
                )}
              </LinhaSupervisorQuartil>
            );
          })}
        </div>
      </section>
    </div>
  );
}
