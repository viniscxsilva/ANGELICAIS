import type { UserRole } from "@/lib/auth/get-current-user";
import { can } from "@/lib/auth/permissions";

import type { SidebarSection } from "./sidebar";

const ALL_SECTIONS: SidebarSection[] = [
  {
    id: "gestor",
    label: "Reports",
    iconName: "chart",
    basePath: "/reports",
    permission: "view_gestor_panel",
    // Só o GESTOR vê — o ADM tem a permissão, mas não acessa esta tela.
    onlyRoles: ["GESTOR"],
    // Divisória "MEUS RESULTADOS" acima do grupo Reports — só aparece pro GESTOR
    // porque esta seção já é onlyRoles: ["GESTOR"].
    divider: "MEUS RESULTADOS",
    items: [
      { label: "Consolidado", href: "/reports/consolidado" },
      { label: "Tempo Logado & Indisp.", href: "/reports/tempo-indisponibilidade" },
    ],
  },
  {
    id: "operacional",
    label: "KPI",
    iconName: "headset",
    // Amplo o suficiente pra cobrir /kpi/operadores e /kpi/gestor (só o
    // GESTOR vê esta seção — nenhuma outra rota /kpi/* é alcançável por ele,
    // então não há risco de ativar a seção errada).
    basePath: "/kpi",
    permission: "view_gestor_panel",
    onlyRoles: ["GESTOR"],
    items: [
      { label: "Operadores", href: "/kpi/operadores" },
      { label: "Gestor", href: "/kpi/gestor" },
    ],
  },
  {
    id: "configuracoes-gestor",
    label: "Configurações",
    iconName: "settings",
    basePath: "/configuracoes",
    permission: "view_gestor_panel",
    onlyRoles: ["GESTOR"],
    items: [
      { label: "Equipe", href: "/configuracoes/equipe" },
    ],
  },
  {
    id: "operacao",
    label: "Operação",
    iconName: "users",
    basePath: "/operacao",
    permission: "view_gestor_panel",
    // Mesmo escopo de "MEUS RESULTADOS": só o GESTOR vê. Divisória própria
    // "OUTROS DADOS" — irmã de "MEUS RESULTADOS", logo abaixo dela.
    onlyRoles: ["GESTOR"],
    divider: "OUTROS DADOS",
    items: [
      { label: "Diário", href: "/operacao/diario" },
      { label: "Análise Operadores", href: "/operacao/analise-operadores" },
      { label: "Comparativo Consolidado", href: "/operacao/comparativo-consolidado" },
      { label: "Quartil", href: "/operacao/quartil" },
      { label: "KPI Detalhado", href: "/operacao/kpi-detalhado" },
    ],
  },
  {
    id: "bases",
    label: "Bases",
    iconName: "database",
    basePath: "/bases",
    permission: "manage_base",
    divider: "PAINEL ADM",
    items: [
      { label: "KPI", href: "/bases/kpi" },
      { label: "Pausas", href: "/bases/pausas" },
    ],
  },
  {
    id: "config",
    label: "Configurações",
    iconName: "settings",
    basePath: "/configuracoes",
    permission: "manage_system",
    items: [{ label: "Usuários", href: "/configuracoes/usuarios" }],
  },
];

/**
 * @param isAdminSkill Flag aditiva (profiles.is_admin_skill): um GESTOR com
 * essa flag acumula também o que o ADM exclusivo vê, sem perder nada do que
 * já via como GESTOR — nunca substitui o role, só soma. Irrelevante pra
 * qualquer role que não seja GESTOR.
 */
export function getSidebarSectionsForRole(
  role: UserRole,
  isAdminSkill = false,
): SidebarSection[] {
  return ALL_SECTIONS.filter(
    (section) =>
      can(role, section.permission, isAdminSkill) &&
      (!section.onlyRoles || section.onlyRoles.includes(role)),
  );
}
