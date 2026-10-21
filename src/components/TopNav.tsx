"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface TopNavProps {
  userEmail?: string | null;
  userName?: string | null;
}

interface NavItem {
  label: string;
  mobileLabel: string;
  href: string;
  icon: "dashboard" | "products" | "purchases" | "sales" | "expenses";
}

function NavIcon({
  name,
  className = "h-5 w-5",
}: {
  name: NavItem["icon"];
  className?: string;
}) {
  switch (name) {
    case "dashboard":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
      );
    case "products":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="M12 22V12" />
        </svg>
      );
    case "purchases":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
          <path d="M15 18H9" />
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14v10Z" />
          <circle cx="17" cy="18" r="2" />
          <circle cx="7" cy="18" r="2" />
        </svg>
      );
    case "sales":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
          <path d="M8 7h8" />
          <path d="M8 11h8" />
          <path d="M8 15h5" />
        </svg>
      );
    case "expenses":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
          <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
        </svg>
      );
  }
}

export default function TopNav({ userEmail, userName }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const navItems: NavItem[] = [
    { label: "Ringkasan", mobileLabel: "Ringkasan", href: "/dashboard", icon: "dashboard" },
    { label: "Stok & Harga", mobileLabel: "Stok", href: "/products", icon: "products" },
    { label: "Kulakan", mobileLabel: "Kulakan", href: "/purchases", icon: "purchases" },
    { label: "Piutang & Penjualan", mobileLabel: "Penjualan", href: "/sales", icon: "sales" },
    { label: "Biaya Operasional", mobileLabel: "Biaya", href: "/expenses", icon: "expenses" },
  ];

  return (
    <>
      {/* Top Header: Brand & Akun (Desktop & Mobile) */}
      <header className="sticky top-0 z-40 border-b border-slate-300 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-slate-900">ILuvBesi</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
              Manajemen Toko
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="inline-flex h-9 items-center gap-1.5 rounded border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 text-blue-900"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              <span className="hidden sm:inline">Unduh Kasir Desktop</span>
              <span className="sm:hidden">Unduh POS</span>
            </Link>
            <span className="hidden text-xs text-slate-700 md:inline-block">
              {userName || userEmail || "Pemilik Toko"}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="h-9 sm:h-10 rounded border border-slate-300 bg-white px-2.5 sm:px-3 text-xs sm:text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
            >
              Keluar
            </button>
          </div>
        </div>

        {/* Tab Navigasi Desktop: Ditampilkan di atas layar lebar (>= md) */}
        <nav aria-label="Navigasi Desktop" className="hidden md:block border-t border-slate-200 bg-slate-50">
          <div className="mx-auto flex max-w-7xl overflow-x-auto px-4 sm:px-6 whitespace-nowrap">
            {navItems.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${
                    isActive
                      ? "border-blue-900 bg-white text-blue-900 font-bold"
                      : "border-transparent text-slate-700 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  <NavIcon
                    name={item.icon}
                    className={`h-4 w-4 ${isActive ? "text-blue-900" : "text-slate-500"}`}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Tab Navigasi Ponsel (Bottom Navigation Bar): Mudah dijangkau jempol kanan dengan Icon */}
      <nav
        aria-label="Navigasi Bawah Ponsel"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-300 bg-white md:hidden shadow-[0_-2px_10px_rgba(0,0,0,0.08)]"
      >
        <div
          className="grid grid-cols-5"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-16 flex-col items-center justify-center gap-1 px-1 text-center transition-colors ${
                  isActive
                    ? "border-t-4 border-blue-900 bg-blue-50/80 text-blue-900 font-bold"
                    : "border-t-4 border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium"
                }`}
              >
                <NavIcon
                  name={item.icon}
                  className={`h-5 w-5 ${isActive ? "text-blue-900" : "text-slate-500"}`}
                />
                <span className="text-[11px] leading-tight tracking-tight">
                  {item.mobileLabel}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
