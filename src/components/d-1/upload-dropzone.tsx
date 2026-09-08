"use client";

import { useCallback, useState } from "react";
import { IconCloudUpload, IconFileSpreadsheet } from "@tabler/icons-react";
import Papa from "papaparse";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { uploadConsolidadoAction } from "@/lib/d1-db/actions/upload-consolidado-action";
import { registrarExibicaoPopupComparativoAction } from "@/lib/retencao/comparativo/registrar-exibicao-popup-action";
import { ComparativoPopupDialog } from "@/components/operacional/comparativo-consolidado/comparativo-popup-dialog";
import { handleStaleActionError } from "@/lib/utils/handle-stale-action-error";
import { UploadProgressModal } from "./upload-progress-modal";

export type UploadStep =
  | "attaching"
  | "deleting"
  | "replacing"
  | "done"
  | null;

interface UploadDropzoneProps {
  /**
   * Variante enxuta (usada em /reports/consolidado/analitico): sem o ícone
   * central e com a área de drop bem mais baixa. Default false — o
   * /reports/consolidado continua com o card cheio. Só muda o visual; drag &
   * drop, parse, action de upload, modal de progresso e popup do comparativo
   * seguem idênticos.
   */
  compact?: boolean;
}

export function UploadDropzone({ compact = false }: UploadDropzoneProps = {}) {
  const [step, setStep] = useState<UploadStep>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rowsWritten, setRowsWritten] = useState<number>(0);
  const [isHovering, setIsHovering] = useState(false);
  const [showComparativoPopup, setShowComparativoPopup] = useState(false);

  // Executa o upload de fato (etapas + action + reload).
  const processUpload = useCallback(async (csvText: string) => {
    setStep("deleting");
    await new Promise((r) => setTimeout(r, 400));

    setStep("replacing");

    let uploadResult;
    try {
      uploadResult = await uploadConsolidadoAction(csvText);
    } catch (err) {
      setStep(null);
      // Server Action de um build anterior (hot reload em dev, ou deploy
      // novo em produção com a aba aberta) — avisa e recarrega em vez de
      // deixar o upload falhar silenciosamente no console.
      if (handleStaleActionError(err)) return;
      setErrorMessage("Erro inesperado ao enviar a base.");
      toast.error("Falha ao atualizar base");
      console.error("[upload] action error:", err);
      return;
    }

    if (!uploadResult.success) {
      setStep(null);
      setErrorMessage(uploadResult.error);
      toast.error("Falha ao atualizar base", {
        description: uploadResult.error,
      });
      return;
    }

    setRowsWritten(uploadResult.rowsWritten);
    setStep("done");
    toast.success("Base updated", {
      description: `${uploadResult.rowsWritten} linhas inseridas`,
    });

    // Efeito posterior ao report, nunca bloqueante: no PRIMEIRO report do dia
    // civil, convida o gestor a ver o comparativo entre equipes. A action é
    // fail-safe (qualquer erro → mostrar:false), então isso nunca trava o
    // fluxo de geração do report.
    const { mostrar } = await registrarExibicaoPopupComparativoAction();
    if (mostrar) {
      // Sem o reload automático: a página é mantida para o popup sobreviver.
      // O refresh dos dados passa a ser feito ao fechar o popup.
      setStep(null);
      setShowComparativoPopup(true);
      return;
    }

    setTimeout(() => {
      setStep(null);
      window.location.reload();
    }, 3000);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setErrorMessage(null);
    setStep("attaching");

    try {
      // Lê o arquivo como ArrayBuffer pra detectar encoding
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      let csvText: string;

      // Detecta BOM UTF-8 (EF BB BF)
      if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        // UTF-8 com BOM — pula os 3 primeiros bytes
        csvText = new TextDecoder("utf-8").decode(bytes.slice(3));
      } else {
        // Tenta UTF-8 primeiro (modo estrito)
        try {
          const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
          csvText = utf8Decoder.decode(bytes);
        } catch {
          // UTF-8 falhou — provavelmente Windows-1252 (CSV exportado do Excel)
          csvText = new TextDecoder("windows-1252").decode(bytes);
        }
      }

      // Agora passa a STRING decodificada pro papaparse
      Papa.parse<string[]>(csvText, {
        complete: async (result) => {
          if (result.errors.length > 0) {
            setStep(null);
            setErrorMessage("Erro ao ler o CSV. Verifique o formato.");
            toast.error("CSV inválido");
            return;
          }

          const rows = result.data.filter((row) =>
            row.some((cell) => cell !== ""),
          );

          if (rows.length < 2) {
            setStep(null);
            setErrorMessage("CSV vazio ou só com cabeçalho.");
            toast.error("CSV vazio");
            return;
          }

          // Delay pra UX mostrar a etapa "ANEXANDO"
          await new Promise((r) => setTimeout(r, 600));

          await processUpload(csvText);
        },
        error: (err: Error) => {
          setStep(null);
          setErrorMessage(err.message);
          toast.error("Erro ao processar arquivo");
        },
        skipEmptyLines: true,
      });
    } catch (err) {
      setStep(null);
      setErrorMessage("Erro ao ler arquivo");
      toast.error("Não foi possível ler o arquivo");
      console.error("[upload] read error:", err);
    }
  }, [processUpload]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      handleFile(file);
    },
    [handleFile],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: {
        "text/csv": [".csv"],
        "application/vnd.ms-excel": [".csv"],
      },
      multiple: false,
      disabled: step !== null && step !== "done",
    });

  const isProcessing = step !== null && step !== "done";

  return (
    <>
      <div
        {...getRootProps({
          onMouseEnter: () => setIsHovering(true),
          onMouseLeave: () => setIsHovering(false),
        })}
        className="relative flex h-full cursor-pointer items-center justify-center rounded-xl border border-dashed transition-all duration-300 hover:border-primary"
        style={{
          background: isDragActive
            ? "color-mix(in oklch, var(--primary) 8%, var(--muted))"
            : isHovering
              ? "var(--muted-hover-bg, var(--card))"
              : "var(--upload-idle-bg, var(--card))",
          borderColor: isDragReject
            ? "var(--danger)"
            : isDragActive
              ? "var(--primary)"
              : "var(--border)",
          boxShadow: isDragActive
            ? "0 0 40px var(--glow-accent)"
            : "var(--shadow-sm, none)",
          padding: compact ? "0.875rem 1.25rem" : "2.5rem 1.5rem",
          opacity: isProcessing ? 0.5 : 1,
          pointerEvents: isProcessing ? "none" : "auto",
          minHeight: compact ? "auto" : "100%",
        }}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center justify-center gap-3 text-center">
          {!compact && (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/80 bg-muted/40 text-muted-foreground">
              {isDragActive ? (
                <IconCloudUpload
                  size={30}
                  aria-hidden="true"
                />
              ) : (
                <IconFileSpreadsheet
                  size={30}
                  aria-hidden="true"
                />
              )}
            </div>
          )}

          <div className={compact ? "space-y-0.5" : "space-y-1"}>
            <p
              className={
                compact
                  ? "ds-body text-foreground text-sm font-semibold"
                  : "ds-body text-foreground font-semibold"
              }
            >
              {isDragActive
                ? "Solte o arquivo para enviar"
                : "Arraste o arquivo CSV aqui ou clique para selecionar"}
            </p>
            <p className="ds-mono-sm text-muted-foreground/80 text-[11px]">
              Apenas arquivos .csv · limite de 10.000 linhas
            </p>
          </div>
        </div>

        {errorMessage && !isProcessing && (
          <div
            role="alert"
            className="status-danger ds-small mt-4 flex items-center justify-center gap-2 rounded-md p-3"
          >
            {errorMessage}
          </div>
        )}
      </div>

      <UploadProgressModal step={step} rowsWritten={rowsWritten} />

      <ComparativoPopupDialog
        open={showComparativoPopup}
        onOpenChange={(open) => {
          setShowComparativoPopup(open);
          // Fechar sem navegar ("Agora não" ou clique fora): recarrega para
          // refletir o report recém-gerado, como fazia o fluxo original.
          if (!open) window.location.reload();
        }}
      />
    </>
  );
}
