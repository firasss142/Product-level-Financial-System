import {
  LayoutDashboard,
  Package,
  Box,
  Users,
  Megaphone,
  Briefcase,
  Scale,
  Receipt,
  Settings,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
}

export const navItems: NavItem[] = [
  { label: "Tableau de bord", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Commandes", icon: Package, href: "/orders" },
  { label: "Produits", icon: Box, href: "/products" },
  { label: "Comptes", icon: Users, href: "/accounts" },
  { label: "Campagnes", icon: Megaphone, href: "/campaigns" },
  { label: "Investisseurs", icon: Briefcase, href: "/investors" },
  { label: "Rapprochement", icon: Scale, href: "/reconciliation" },
  { label: "Frais fixes", icon: Receipt, href: "/overhead" },
  { label: "Paramètres", icon: Settings, href: "/settings" },
  { label: "Synchronisation", icon: RefreshCw, href: "/sync" },
];

export function getPageTitle(pathname: string): string {
  for (const { href, label } of navItems) {
    if (pathname === href || pathname.startsWith(href + "/")) {
      return label;
    }
  }
  return "COD Profitability";
}
