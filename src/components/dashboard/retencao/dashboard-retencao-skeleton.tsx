"use client";

import { useEffect, useState } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { PageTransition } from "@/components/motion/page-transition";
import { toast } from "sonner";
import { StyledCard } from "@/components/gestor/styled-card";
import { UploadDropzone } from "@/components/d-1/upload-dropzone";
import { fetchDashboardRetencaoAction } from "@/lib/retencao/actions";
import type { VisaoGeralData } from "@/lib/retencao/get-visao-geral";
import type { TemaData } from "@/lib/retencao/get-por-tema";
import type { HoraEvolucaoData } from "@/lib/retencao/get-evolucao-hora";
import type { SegmentoResult } from "@/lib/retencao/get-por-segmento";
import type { OperadorQuartilItem } from "@/lib/retencao/get-quartil-operadores";
import type { MatrizResult } from "@/lib/retencao/get-matriz-volume-taxa";
import type { OperadorIndividual } from "@/lib/retencao/get-por-operador-individual";
import type { QuartilOperador } from "@/lib/retencao/get-quartil-operador";
import type { NomeFantasiaSerial } from "@/lib/gestor/nome-fantasia/aplicar-fantasia";
import { VisaoGeralCards } from "./visao-geral-cards";
import { TabelaTemas } from "./tabela-temas";
import { GraficoEvolucao } from "./grafico-evolucao";
import { OperadoresLista } from "./operadores-lista";
import { TabelaSegmentos } from "./tabela-segmentos";
import { DistribuicaoQuartis } from "./distribuicao-quartis";
import { CopiarContratos } from "./copiar-contratos";
import { ConfigMetasPopover } from "./config-metas-popover";

interface DashboardRetencaoSkeletonProps {
  emailsEquipe: string[];
  userKey: string;
  gestora?: string;
  reportHora?: string | null;
  /** Mostra a área de upload da base D-1 (gated por manage_d1_base na página). */
  showUpload?: boolean;
}

export function DashboardRetencaoSkeleton({
  emailsEquipe: emailsEquipeIniciais,
  userKey,
  gestora = "Equipe",
  reportHora: reportHoraInicial,
  showUpload = false,
}: DashboardRetencaoSkeletonProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailsEquipe, setEmailsEquipe] = useState<string[]>(emailsEquipeIniciais);
  const [currentReportHora, setCurrentReportHora] = useState<string | null>(reportHoraInicial ?? null);

  const [data, setData] = useState<{
    visaoGeral: VisaoGeralData;
    porTema: TemaData[];
    evolucaoHora: HoraEvolucaoData[];
    porSegmento: SegmentoResult;
    quartilOperadores: OperadorQuartilItem[];
    quartilPolo: OperadorQuartilItem[];
    matriz: MatrizResult;
    operadoresIndividual: OperadorIndividual[];
    quartilPorOperador: Record<string, QuartilOperador>;
    nomeFantasia: NomeFantasiaSerial;
    meta: number;
  } | null>(null);

  // Metas configuradas localmente
  // Espelha o open/close do ConfigMetasPopover só pra elevar o gráfico acima
  // do overlay de blur (z-40) enquanto o popover está aberto.
  const [configMetasOpen, setConfigMetasOpen] = useState(false);

  const [metaGlobal, setMetaGlobal] = useState<number>(65);
  const [themeMetas, setThemeMetas] = useState<Record<string, number>>({
    "Mot. Financeiro": 80,
    "Ins. Atendimento": 80,
    "Ins. Serviço": 80,
    "Mud. Endereço": 60,
    "Mud. Provedora": 60,
    "Outros": 60,
  });

  // Carrega configurações salvas no localStorage (escopadas por usuário)
  useEffect(() => {
    if (!userKey) return;
    const globalKey = `retencao_meta_global_${userKey.toLowerCase().trim()}`;
    const savedGlobal = localStorage.getItem(globalKey);
    if (savedGlobal) {
      setMetaGlobal(Number(savedGlobal));
    } else {
      setMetaGlobal(65);
    }
  }, [userKey]);

  useEffect(() => {
    if (!userKey) return;
    const themesKey = `retencao_meta_temas_${userKey.toLowerCase().trim()}`;
    const savedThemes = localStorage.getItem(themesKey);
    if (savedThemes) {
      try {
        const parsed = JSON.parse(savedThemes);
        setThemeMetas({
          "Mot. Financeiro": 80,
          "Ins. Atendimento": 80,
          "Ins. Serviço": 80,
          "Mud. Endereço": 60,
          "Mud. Provedora": 60,
          "Outros": 60,
          ...parsed,
        });
      } catch (e) {
        console.error("Erro ao parsear metas do localStorage:", e);
      }
    } else {
      setThemeMetas({
        "Mot. Financeiro": 80,
        "Ins. Atendimento": 80,
        "Ins. Serviço": 80,
        "Mud. Endereço": 60,
        "Mud. Provedora": 60,
        "Outros": 60,
      });
    }
  }, [userKey]);

  const handleSaveMetas = (newGlobal: number, newThemes: Record<string, number>) => {
    if (!userKey) return;
    setMetaGlobal(newGlobal);
    setThemeMetas(newThemes);
    const globalKey = `retencao_meta_global_${userKey.toLowerCase().trim()}`;
    const themesKey = `retencao_meta_temas_${userKey.toLowerCase().trim()}`;
    localStorage.setItem(globalKey, String(newGlobal));
    localStorage.setItem(themesKey, JSON.stringify(newThemes));
    toast.success("Metas salvas com sucesso!");
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const result = await fetchDashboardRetencaoAction();

        if (!active) return;

        if (result.success && result.data) {
          setData({
            visaoGeral: result.data.visaoGeral,
            porTema: result.data.porTema,
            evolucaoHora: result.data.evolucaoHora,
            porSegmento: result.data.porSegmento,
            quartilOperadores: result.data.quartilOperadores,
            quartilPolo: result.data.quartilPolo,
            matriz: result.data.matriz,
            operadoresIndividual: result.data.operadoresIndividual,
            quartilPorOperador: result.data.quartilPorOperador,
            nomeFantasia: result.data.nomeFantasia,
            meta: result.data.meta,
          });
          setEmailsEquipe(result.data.emailsEquipe);
          if (result.data.reportHora) {
            setCurrentReportHora(result.data.reportHora);
          }
        } else {
          setError(result.error || "Erro ao carregar dados do dashboard.");
        }
      } catch (err) {
        if (!active) return;
        setError("Erro inesperado ao carregar dados.");
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const hasNoData = !data || data.visaoGeral.total === 0;

  // Cálculo robusto da hora do report com múltiplos níveis de suporte
  let effectiveHora = currentReportHora || reportHoraInicial || null;
  if ((!effectiveHora || effectiveHora === "—") && data?.evolucaoHora) {
    const horasComDados = data.evolucaoHora.filter((h) => h.total > 0);
    if (horasComDados.length > 0) {
      const maxH = horasComDados[horasComDados.length - 1];
      effectiveHora = `${String(maxH.hora).padStart(2, "0")}:00`;
    }
  }

  const horaFormatada = effectiveHora && effectiveHora !== "—"
    ? (effectiveHora.match(/^(\d{1,2}:\d{2})/)?.[1] ?? effectiveHora)
    : null;

  return (
    <PageTransition>
      <div className="min-h-screen px-6 py-8 lg:px-12 lg:py-12">
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body {
                scrollbar-width: thin !important;
                scrollbar-color: var(--border) transparent !important;
              }
              html::-webkit-scrollbar, body::-webkit-scrollbar {
                width: 8px !important;
                height: 8px !important;
              }
              html::-webkit-scrollbar-track, body::-webkit-scrollbar-track {
                background: transparent !important;
              }
              html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb {
                background: var(--border) !important;
                border-radius: 4px !important;
              }
              html::-webkit-scrollbar-thumb:hover, body::-webkit-scrollbar-thumb:hover {
                background: var(--muted-foreground) !important;
              }
            `,
          }}
        />
        <div className="mx-auto max-w-7xl space-y-8">
          <header className="border-border flex flex-col gap-2 border-b border-dashed pb-4">
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              Painel do Gestor
            </span>
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="ds-h1">Analítico</h1>
              <span className="ds-mono-sm text-muted-foreground">
                / Consolidado · {gestora}
                {horaFormatada && <> · report às {horaFormatada}</>}
              </span>
            </div>
          </header>

          {showUpload && (
            <StyledCard withGradient className="flex flex-col p-3">
              <span className="text-muted-foreground mb-2 block text-xs font-semibold uppercase tracking-wider">
                Atualizar Base D-1
              </span>
              <UploadDropzone compact />
            </StyledCard>
          )}

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <IconLoader2 size={36} className="animate-spin text-primary" />
          <p className="ds-small text-muted-foreground">Carregando dados analíticos...</p>
        </div>
      ) : error ? (
        <div className="elevation-1 bg-card border border-border/60 rounded-xl p-8 text-center min-h-[250px] flex flex-col items-center justify-center">
          <p className="ds-body text-danger font-medium">{error}</p>
        </div>
      ) : hasNoData ? (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 elevation-1 bg-card border border-border/60 rounded-xl p-8 flex flex-col items-center justify-center text-center min-h-[350px]">
            <div className="max-w-md space-y-3">
              <h3 className="ds-h3 text-foreground font-semibold">Nenhum atendimento encontrado</h3>
              <p className="ds-body text-muted-foreground text-sm">
                Não existem registros de atendimentos de retenção cadastrados no
                banco para a sua equipe.
              </p>
            </div>
          </div>

          {/* Painel da Equipe Mapeada */}
          <div className="elevation-1 bg-card border border-border/60 rounded-xl p-6 space-y-4 flex flex-col">
            <div>
              <h4 className="ds-mono-sm font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">
                Mapeamento de Equipe
              </h4>
              <p className="ds-body text-foreground mt-1 font-semibold text-sm">
                {emailsEquipe.length} operadores
              </p>
            </div>

            <div className="flex-1 min-h-[200px] max-h-[350px] overflow-y-auto border border-border/40 rounded-lg p-3 bg-black/5 space-y-1.5 scrollbar-tema">
              {emailsEquipe.length === 0 ? (
                <p className="ds-small text-muted-foreground text-center py-8">
                  Nenhum operador na equipe.
                </p>
              ) : (
                emailsEquipe.map((email) => (
                  <div
                    key={email}
                    className="ds-mono-sm px-2.5 py-1 bg-muted/40 rounded border border-border/20 text-muted-foreground truncate text-xs"
                  >
                    {email}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Bloco 1: Visão Geral */}
          <VisaoGeralCards data={data!.visaoGeral} meta={metaGlobal} />

          {/* Bloco 3: Evolução e Pedidos do Turno (estendido por toda a largura) */}
          <div className={configMetasOpen ? "relative z-50" : undefined}>
            <GraficoEvolucao
              dados={data!.evolucaoHora}
              meta={metaGlobal}
              acoes={
                <ConfigMetasPopover
                  metaGlobal={metaGlobal}
                  themeMetas={themeMetas}
                  onSave={handleSaveMetas}
                  onOpenChange={setConfigMetasOpen}
                />
              }
            />
          </div>

          {/* Análise individual por operador */}
          <OperadoresLista
            operadores={data!.operadoresIndividual}
            meta={metaGlobal}
            quartilPorOperador={data!.quartilPorOperador}
          />

          {/* Retenção por Temas (Estendido horizontalmente igual a Operadores) */}
          <TabelaTemas temas={data!.porTema} metaGlobal={metaGlobal} themeMetas={themeMetas} />

          {/* Divisor de Quartil (Estendido horizontalmente abaixo de Retenção por Temas) */}
          <DistribuicaoQuartis
            operadores={data!.quartilOperadores}
            operadoresPolo={data!.quartilPolo}
            meta={metaGlobal}
          />

          {/* Desempenho por Segmento (Estendido horizontalmente) */}
          <TabelaSegmentos segmentos={data!.porSegmento} meta={metaGlobal} />

          {/* Copiar Contratos da Equipe (Estendido horizontalmente) */}
          <CopiarContratos
            emailsEquipe={emailsEquipe}
            porTema={data!.porTema}
            operadoresIndividual={data!.operadoresIndividual}
          />

          {/* Configurações de Metas (Ocultado visualmente a pedido do usuário) */}
          <div className="hidden" aria-hidden="true">
          </div>
        </div>
      )}
        </div>
      </div>
    </PageTransition>
  );
}
