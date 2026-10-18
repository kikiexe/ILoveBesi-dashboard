"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type DetectedOS = "windows" | "linux" | "macos" | "other";

interface ReleaseInfo {
  version: string;
  publishedDate: string | null;
}

const GITHUB_DOWNLOAD_BASE = "https://github.com/kikiexe/ILoveBesi-desktop/releases/latest/download";

export default function LandingDownloadPage() {
  const [detectedOs, setDetectedOs] = useState<DetectedOS>("other");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo>({
    version: "v1.0.3",
    publishedDate: null,
  });

  useEffect(() => {
    /* Deteksi sistem operasi pengunjung */
    if (typeof window !== "undefined" && window.navigator) {
      const ua = window.navigator.userAgent.toLowerCase();
      if (ua.includes("win")) {
        setDetectedOs("windows");
      } else if (ua.includes("mac") || ua.includes("darwin")) {
        setDetectedOs("macos");
      } else if (ua.includes("linux") || ua.includes("x11")) {
        setDetectedOs("linux");
      }
    }

    /* Periksa status sesi login pemilik toko */
    const checkSession = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        setIsLoggedIn(!!session);
      } catch {
        setIsLoggedIn(false);
      }
    };
    checkSession();

    /* Ambil metadata versi terbaru dari API GitHub dengan fallback aman */
    const fetchLatestRelease = async () => {
      try {
        const res = await fetch("https://api.github.com/repos/kikiexe/ILoveBesi-desktop/releases/latest", {
          headers: { Accept: "application/vnd.github.v3+json" },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.tag_name) {
            setReleaseInfo({
              version: data.tag_name,
              publishedDate: data.published_at ? new Date(data.published_at).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              }) : null,
            });
          }
        }
      } catch {
        /* Fallback ke default jika offline atau terkena limit API */
      }
    };
    fetchLatestRelease();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header Navigasi Publik */}
      <header className="sticky top-0 z-40 border-b border-slate-300 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-blue-900 font-black text-white text-base">
              IB
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900">ILoveBesi</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold text-slate-500">
                Sistem Kasir POS & Manajemen Toko Besi
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex h-10 items-center justify-center rounded bg-blue-900 px-4 text-xs font-bold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              >
                Buka Dashboard Toko
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded border border-slate-300 bg-white px-4 text-xs font-bold text-slate-900 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              >
                Masuk Dashboard Pemilik
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Bagian Hero & Rekomendasi Unduhan Utama */}
      <section className="border-b border-slate-300 bg-white py-12 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900 mb-4">
            <span>Rilis Resmi Desktop POS:</span>
            <span className="font-mono font-bold">{releaseInfo.version}</span>
            {releaseInfo.publishedDate && (
              <span className="text-blue-700">({releaseInfo.publishedDate})</span>
            )}
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Unduh Aplikasi Kasir Desktop ILoveBesi POS
          </h1>

          <p className="mt-3 text-sm text-slate-600 sm:text-base max-w-2xl mx-auto">
            Aplikasi kasir desktop berkecepatan tinggi untuk toko material besi hollow galvanis.
            Didesain khusus untuk operasional kasir harian dengan navigasi penuh keyboard.
          </p>

          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 max-w-2xl mx-auto text-left flex items-start gap-2.5">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-amber-800 shrink-0 mt-0.5"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
            <div>
              <strong className="font-bold">Informasi Isi Paket Unduhan:</strong>
              <p className="mt-0.5">
                Setiap unduhan berbentuk paket <strong>.ZIP</strong> yang sudah berisi File Installer Aplikasi Kasir beserta file teks <strong>PANDUAN-INSTALASI-DAN-PENGGUNAAN.txt</strong>.
              </p>
            </div>
          </div>

          {/* Tombol Rekomendasi Otomatis Sesuai OS */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            {detectedOs === "windows" && (
              <a
                href={`${GITHUB_DOWNLOAD_BASE}/ILoveBesi-POS-Windows-64bit.zip`}
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded bg-blue-900 px-6 text-sm font-bold text-white hover:bg-blue-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.949-1.801" />
                </svg>
                <span>Unduh Paket Windows (.zip) [Rekomendasi untuk PC Anda]</span>
              </a>
            )}

            {detectedOs === "linux" && (
              <a
                href={`${GITHUB_DOWNLOAD_BASE}/ILoveBesi-POS-Linux-DEB.zip`}
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded bg-blue-900 px-6 text-sm font-bold text-white hover:bg-blue-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                  <polyline points="4 17 10 11 4 5" />
                  <line x1="12" x2="20" y1="19" y2="19" />
                </svg>
                <span>Unduh Paket Linux Ubuntu / Debian (.deb .zip)</span>
              </a>
            )}

            {detectedOs === "macos" && (
              <a
                href={`${GITHUB_DOWNLOAD_BASE}/ILoveBesi-POS-macOS-Apple-Silicon.zip`}
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded bg-blue-900 px-6 text-sm font-bold text-white hover:bg-blue-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.84c.64-.78 1.08-1.86.96-2.94-1 .04-2.13.67-2.79 1.45-.58.67-1.1 1.76-.96 2.82 1.11.09 2.17-.57 2.79-1.33z" />
                </svg>
                <span>Unduh Paket macOS Apple Silicon (.zip)</span>
              </a>
            )}

            {detectedOs === "other" && (
              <a
                href={`${GITHUB_DOWNLOAD_BASE}/ILoveBesi-POS-Windows-64bit.zip`}
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded bg-blue-900 px-6 text-sm font-bold text-white hover:bg-blue-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.949-1.801" />
                </svg>
                <span>Unduh Paket Windows (.zip)</span>
              </a>
            )}

            <a
              href={`${GITHUB_DOWNLOAD_BASE}/PANDUAN-INSTALASI-DAN-PENGGUNAAN.txt`}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded border border-slate-300 bg-white px-5 text-xs font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-slate-600" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" x2="8" y1="13" y2="13" />
                <line x1="16" x2="8" y1="17" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Baca Panduan TXT Langsung</span>
            </a>
          </div>
        </div>
      </section>

      {/* Grid Daftar Unduhan Lengkap Berdasarkan Sistem Operasi */}
      <section className="py-12 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 border-b border-slate-300 pb-3">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Pusat Unduhan Seluruh Sistem Operasi
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Pilih paket arsip .zip yang sesuai dengan sistem operasi komputer kasir Anda.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Kartu 1: Windows */}
            <div className={`rounded-md border p-6 bg-white flex flex-col justify-between ${
              detectedOs === "windows" ? "border-blue-900 ring-2 ring-blue-900 shadow-md" : "border-slate-300 shadow-sm"
            }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-100 text-blue-900">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                        <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.949-1.801" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Windows 10 / 11</h3>
                  </div>
                  {detectedOs === "windows" && (
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-900 border border-blue-200">
                      OS Anda
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  Arsip installer untuk PC kasir Windows 64-bit. Berisi installer NSIS Setup (.exe) dan Windows Installer (.msi).
                </p>

                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs mb-4 space-y-1">
                  <div className="text-slate-600"><strong>Isi Paket .ZIP:</strong></div>
                  <ul className="list-disc pl-4 text-slate-700 space-y-0.5">
                    <li>Installer Setup .exe (NSIS)</li>
                    <li>Installer Setup .msi</li>
                    <li>PANDUAN-INSTALASI-DAN-PENGGUNAAN.txt</li>
                  </ul>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={`${GITHUB_DOWNLOAD_BASE}/ILoveBesi-POS-Windows-64bit.zip`}
                  className="w-full inline-flex h-11 items-center justify-center gap-2 rounded bg-blue-900 px-4 text-xs font-bold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                  <span>Unduh Paket Windows (.zip)</span>
                </a>
              </div>
            </div>

            {/* Kartu 2: Linux */}
            <div className={`rounded-md border p-6 bg-white flex flex-col justify-between ${
              detectedOs === "linux" ? "border-blue-900 ring-2 ring-blue-900 shadow-md" : "border-slate-300 shadow-sm"
            }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-slate-800">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                        <polyline points="4 17 10 11 4 5" />
                        <line x1="12" x2="20" y1="19" y2="19" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Linux Distribution</h3>
                  </div>
                  {detectedOs === "linux" && (
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-900 border border-blue-200">
                      OS Anda
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  Tersedia untuk berbagai varian Linux modern dalam format RPM, DEB, maupun portable AppImage.
                </p>

                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs mb-4 space-y-1">
                  <div className="text-slate-600"><strong>Isi Tiap Paket .ZIP:</strong></div>
                  <ul className="list-disc pl-4 text-slate-700 space-y-0.5">
                    <li>File binary (.rpm, .deb, atau .AppImage)</li>
                    <li>PANDUAN-INSTALASI-DAN-PENGGUNAAN.txt</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <a
                  href={`${GITHUB_DOWNLOAD_BASE}/ILoveBesi-POS-Linux-RPM.zip`}
                  className="w-full inline-flex h-10 items-center justify-between rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                >
                  <span>Fedora / RHEL (.rpm .zip)</span>
                  <span className="font-mono text-[11px] text-slate-500">Unduh</span>
                </a>

                <a
                  href={`${GITHUB_DOWNLOAD_BASE}/ILoveBesi-POS-Linux-DEB.zip`}
                  className="w-full inline-flex h-10 items-center justify-between rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                >
                  <span>Ubuntu / Debian (.deb .zip)</span>
                  <span className="font-mono text-[11px] text-slate-500">Unduh</span>
                </a>

                <a
                  href={`${GITHUB_DOWNLOAD_BASE}/ILoveBesi-POS-Linux-AppImage.zip`}
                  className="w-full inline-flex h-10 items-center justify-between rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                >
                  <span>Universal Linux (.AppImage .zip)</span>
                  <span className="font-mono text-[11px] text-slate-500">Unduh</span>
                </a>
              </div>
            </div>

            {/* Kartu 3: macOS */}
            <div className={`rounded-md border p-6 bg-white flex flex-col justify-between ${
              detectedOs === "macos" ? "border-blue-900 ring-2 ring-blue-900 shadow-md" : "border-slate-300 shadow-sm"
            }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-slate-800">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.84c.64-.78 1.08-1.86.96-2.94-1 .04-2.13.67-2.79 1.45-.58.67-1.1 1.76-.96 2.82 1.11.09 2.17-.57 2.79-1.33z" />
                      </svg>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">macOS (Apple Mac)</h3>
                  </div>
                  {detectedOs === "macos" && (
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-900 border border-blue-200">
                      OS Anda
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                  Paket berkas disk image (.dmg) terpisah untuk Mac dengan prosesor Apple Silicon (M1/M2/M3/M4) maupun Mac berbasis Intel.
                </p>

                <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs mb-4 space-y-1">
                  <div className="text-slate-600"><strong>Isi Tiap Paket .ZIP:</strong></div>
                  <ul className="list-disc pl-4 text-slate-700 space-y-0.5">
                    <li>Berkas installer disk image (.dmg)</li>
                    <li>PANDUAN-INSTALASI-DAN-PENGGUNAAN.txt</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <a
                  href={`${GITHUB_DOWNLOAD_BASE}/ILoveBesi-POS-macOS-Apple-Silicon.zip`}
                  className="w-full inline-flex h-10 items-center justify-between rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                >
                  <span>Apple Silicon (M1/M2/M3/M4 .zip)</span>
                  <span className="font-mono text-[11px] text-slate-500">Unduh</span>
                </a>

                <a
                  href={`${GITHUB_DOWNLOAD_BASE}/ILoveBesi-POS-macOS-Intel.zip`}
                  className="w-full inline-flex h-10 items-center justify-between rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
                >
                  <span>Intel Mac (.dmg .zip)</span>
                  <span className="font-mono text-[11px] text-slate-500">Unduh</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bagian Ringkasan 3 Langkah Instalasi & Penggunaan */}
      <section className="border-t border-slate-300 bg-white py-12 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 border-b border-slate-200 pb-3">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              3 Langkah Memulai Operasional Kasir
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Petunjuk ringkas sejak mengunduh file hingga siap melayani transaksi pelanggan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Langkah 1 */}
            <div className="rounded border border-slate-200 bg-slate-50 p-5 text-xs">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-blue-900 font-bold text-white text-xs">
                  1
                </span>
                <h3 className="font-bold text-sm text-slate-900">Ekstrak File .ZIP & Pasang</h3>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Klik kanan file .zip yang diunduh lalu pilih <strong>Extract All (Ekstrak Semua)</strong>. Buka file <strong>PANDUAN-INSTALASI-DAN-PENGGUNAAN.txt</strong> untuk membaca solusi jika muncul jendela peringatan Windows SmartScreen atau Gatekeeper macOS.
              </p>
            </div>

            {/* Langkah 2 */}
            <div className="rounded border border-slate-200 bg-slate-50 p-5 text-xs">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-blue-900 font-bold text-white text-xs">
                  2
                </span>
                <h3 className="font-bold text-sm text-slate-900">Masuk Akun Toko (Login)</h3>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Jalankan aplikasi kasir, masukkan email dan kata sandi akun toko Anda yang terdaftar. Seluruh katalog produk, ukuran pipa hollow, ketebalan plat, dan harga jual akan langsung tersinkronisasi otomatis.
              </p>
            </div>

            {/* Langkah 3 */}
            <div className="rounded border border-slate-200 bg-slate-50 p-5 text-xs">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-blue-900 font-bold text-white text-xs">
                  3
                </span>
                <h3 className="font-bold text-sm text-slate-900">Buka Kasir & Mulai Transaksi</h3>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Ketik nama kasir jaga dan modal awal laci kasir, lalu tekan <strong>[Enter]</strong>. Gunakan pintasan <strong>F1 s/d F11</strong> untuk transaksi cepat keyboard penuh, dan tombol <strong>[Esc]</strong> untuk rekapitulasi tutup shift kasir.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Sederhana */}
      <footer className="border-t border-slate-300 bg-slate-100 py-6 px-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div>
            <strong>ILoveBesi POS</strong> &copy; {new Date().getFullYear()} Sistem Kasir & Manajemen Toko Besi Hollow Galvanis.
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-slate-900 underline font-medium">
              Login Dashboard Pemilik
            </Link>
            <a
              href={`${GITHUB_DOWNLOAD_BASE}/PANDUAN-INSTALASI-DAN-PENGGUNAAN.txt`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-900 underline font-medium"
            >
              Dokumentasi Panduan TXT
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
