"use client";

import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPageTitle } from "./nav-items";

interface HeaderProps {
  userEmail: string;
  onMenuClick: () => void;
}

export function Header({ userEmail, onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const title = getPageTitle(pathname);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="text-navy hover:text-emerald lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu size={22} />
        </button>
        <h1 className="text-navy font-semibold text-base">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-warm-gray-600 sm:block">{userEmail}</span>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-navy hover:bg-warm-gray-100 transition-colors"
        >
          <LogOut size={15} strokeWidth={1.75} />
          Déconnexion
        </button>
      </div>
    </header>
  );
}
