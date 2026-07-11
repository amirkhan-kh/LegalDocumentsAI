import {
  BarChart3,
  BookOpen,
  Brain,
  FileSearch,
  FileText,
  FlaskConical,
  FolderKanban,
  GitCompareArrows,
  LayoutDashboard,
  Library,
  ListChecks,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Section } from "../features/legal/types";

export type NavigationItem = {
  id: Section;
  label: string;
  icon: LucideIcon;
};

export const navItems: NavigationItem[] = [
  { id: "dashboard", label: "Boshqaruv", icon: LayoutDashboard },
  { id: "review", label: "AI tahlil", icon: FileSearch },
  { id: "contracts", label: "Shartnomalar", icon: FileText },
  { id: "obligations", label: "Majburiyatlar", icon: ListChecks },
  { id: "tasks", label: "Vazifalar", icon: FolderKanban },
  { id: "comparison", label: "Taqqoslash", icon: GitCompareArrows },
  { id: "templates", label: "Shablonlar", icon: Library },
  { id: "knowledge", label: "Bilim bazasi", icon: BookOpen },
  { id: "analytics", label: "Analitika", icon: BarChart3 },
  { id: "staff", label: "AI Lab", icon: FlaskConical },
  { id: "analysis", label: "Tizim tahlili", icon: Brain },
];

export const routeBySection: Record<Section, string> = {
  dashboard: "/dashboard",
  review: "/ai-tahlil",
  contracts: "/shartnomalar",
  obligations: "/majburiyatlar",
  tasks: "/vazifalar",
  comparison: "/taqqoslash",
  templates: "/shablonlar",
  knowledge: "/bilim-bazasi",
  analytics: "/analytics",
  staff: "/staff-lab",
  analysis: "/kotib-tahlili",
};

export const sectionByRoute = Object.fromEntries(
  Object.entries(routeBySection).map(([section, route]) => [route, section]),
) as Record<string, Section>;

export function sectionFromPath(pathname: string): Section {
  return sectionByRoute[pathname] ?? "dashboard";
}

export function labelForSection(section: Section): string {
  return navItems.find((item) => item.id === section)?.label ?? "LegalAI";
}
