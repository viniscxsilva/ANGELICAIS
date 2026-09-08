import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardRetencaoSkeleton } from "@/components/dashboard/retencao/dashboard-retencao-skeleton";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { can } from "@/lib/auth/permissions";
import { getPostLoginPath } from "@/lib/auth/post-login-path";
import { getGestorConsolidado } from "@/lib/d1-db/get-gestor-consolidado";
import { formatNomeProprio } from "@/lib/gestor/derive-nome-operador";
import { getEmailsEquipe } from "@/lib/retencao/get-emails-equipe";

export const metadata: Metadata = {
  title: "Reports - Consolidado - Analítico",
};

export default async function AnaliticoConsolidadoPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Apenas role GESTOR acessa este painel
  if (user.profile.role !== "GESTOR") {
    redirect(getPostLoginPath(user.profile.role));
  }

  const id = user.profile.username || user.profile.emailCorporativo;
  const gestora = user.profile.fullName
    ? formatNomeProprio(user.profile.fullName)
    : "Equipe";

  const [{ reportHora }, emailsEquipe] = await Promise.all([
    getGestorConsolidado(user.profile.id),
    getEmailsEquipe(id),
  ]);

  // Mesma regra do consolidado (gestor-equipe-section.tsx): a barra de upload
  // da base D-1 só aparece para quem tem manage_d1_base.
  const showUpload = can(user.profile.role, "manage_d1_base");

  return (
    <DashboardRetencaoSkeleton
      emailsEquipe={emailsEquipe}
      userKey={id}
      gestora={gestora}
      reportHora={reportHora}
      showUpload={showUpload}
    />
  );
}
