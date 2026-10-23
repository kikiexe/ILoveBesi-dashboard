"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface OSConfig {
  label: string;
  ver: string;
  btnText: string;
  btnSub: string;
  downloadUrl: string;
}

const GITHUB_DESKTOP_BASE =
  "https://github.com/kikiexe/ILoveBesi-desktop/releases/latest/download/";
const GITHUB_MOBILE_APK =
  "https://github.com/kikiexe/ILoveBesi-mobile/releases/latest/download/app-release.apk";

const OS_CONFIGS: Record<"win" | "mac" | "linux" | "android", OSConfig> = {
  win: {
    label: "Terdeteksi: Windows 64-bit",
    ver: "v1.1.1 .ZIP",
    btnText: "Unduh Paket Windows (.zip)",
    btnSub: "Termasuk installer .exe (NSIS), .msi & panduan instalasi TXT",
    downloadUrl: `${GITHUB_DESKTOP_BASE}ILoveBesi-POS-Windows-64bit.zip`,
  },
  mac: {
    label: "Terdeteksi: macOS",
    ver: "v1.1.1 .DMG .ZIP",
    btnText: "Unduh untuk Apple Silicon (.zip)",
    btnSub: "Pakai Intel Mac? Pilih di tab macOS",
    downloadUrl: `${GITHUB_DESKTOP_BASE}ILoveBesi-POS-macOS-Apple-Silicon.zip`,
  },
  linux: {
    label: "Terdeteksi: Linux",
    ver: "v1.1.1 .AppImage .ZIP",
    btnText: "Unduh Universal Portable (.zip)",
    btnSub: "Berisi AppImage & panduan TXT. Paket .deb dan .rpm ada di tab Linux",
    downloadUrl: `${GITHUB_DESKTOP_BASE}ILoveBesi-POS-Linux-AppImage.zip`,
  },
  android: {
    label: "Terdeteksi: Android Smartphone",
    ver: "v1.1.1 .APK",
    btnText: "Unduh ILuvBesi Mobile (.apk)",
    btnSub: "Dashboard realtime pemilik toko untuk Android",
    downloadUrl: GITHUB_MOBILE_APK,
  },
};

interface CartRow {
  name: string;
  qty: string;
  price: string;
  subtotal: string;
  val: number;
}

const DEMO_ROWS: CartRow[] = [
  {
    name: "Hollow Galvanis 40x40 1.6mm",
    qty: "10 BTG",
    price: "125.000",
    subtotal: "1.250.000",
    val: 1250000,
  },
  {
    name: "Plat Strip 25x3mm 6M",
    qty: "5 BTG",
    price: "47.000",
    subtotal: "235.000",
    val: 235000,
  },
];

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"win" | "linux" | "mac" | "android">("win");
  const [detectedOs, setDetectedOs] = useState<"win" | "linux" | "mac" | "android">("win");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // POS Demo states
  const [cartItems, setCartItems] = useState<CartRow[]>([]);
  const [runningTotal, setRunningTotal] = useState(0);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [paidStatus, setPaidStatus] = useState<string>("");

  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Detect OS
    const ua = (navigator.userAgent || "") + " " + (navigator.platform || "");
    let os: "win" | "linux" | "mac" | "android" = "win";
    if (/Android/i.test(ua)) {
      os = "android";
    } else if (/Mac/i.test(ua) && !/iPhone|iPad/i.test(ua)) {
      os = "mac";
    } else if (/Linux/i.test(ua)) {
      os = "linux";
    }
    setDetectedOs(os);
    setActiveTab(os);

    // Check supabase auth
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setIsLoggedIn(!!session);
      } catch {
        setIsLoggedIn(false);
      }
    };
    checkAuth();
  }, []);

  // Demo loop animation
  useEffect(() => {
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) {
      setCartItems(DEMO_ROWS);
      setRunningTotal(1485000);
      setPaidStatus("LUNAS. Nota dicetak.");
      return;
    }

    const clearAll = () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };

    const countSmooth = (from: number, to: number, duration: number) => {
      const startTime = performance.now();
      const step = (now: number) => {
        const progress = Math.min((now - startTime) / duration, 1);
        setRunningTotal(Math.round(from + (to - from) * progress));
        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(step);
        }
      };
      animFrameRef.current = requestAnimationFrame(step);
    };

    const runSimulation = () => {
      clearAll();
      setCartItems([]);
      setRunningTotal(0);
      setPaidStatus("");
      setActiveKey(null);

      // F1 Hit at 700ms
      timersRef.current.push(
        setTimeout(() => {
          setActiveKey("f1");
          timersRef.current.push(setTimeout(() => setActiveKey(null), 380));
        }, 700)
      );

      // Row 1 at 1300ms
      timersRef.current.push(
        setTimeout(() => {
          setCartItems([DEMO_ROWS[0]]);
          countSmooth(0, DEMO_ROWS[0].val, 600);
        }, 1300)
      );

      // Row 2 at 2700ms
      timersRef.current.push(
        setTimeout(() => {
          setCartItems([DEMO_ROWS[0], DEMO_ROWS[1]]);
          countSmooth(DEMO_ROWS[0].val, DEMO_ROWS[0].val + DEMO_ROWS[1].val, 600);
        }, 2700)
      );

      // F8 Hit at 4600ms
      timersRef.current.push(
        setTimeout(() => {
          setActiveKey("f8");
          timersRef.current.push(setTimeout(() => setActiveKey(null), 380));
        }, 4600)
      );

      // F7 Hit at 5600ms
      timersRef.current.push(
        setTimeout(() => {
          setActiveKey("f7");
          timersRef.current.push(setTimeout(() => setActiveKey(null), 380));
        }, 5600)
      );

      // Paid status at 6000ms
      timersRef.current.push(
        setTimeout(() => {
          setPaidStatus("LUNAS. Nota dicetak.");
        }, 6000)
      );

      // Loop restart at 9000ms
      timersRef.current.push(
        setTimeout(() => {
          runSimulation();
        }, 9000)
      );
    };

    runSimulation();

    return () => clearAll();
  }, []);

  const currentOsCfg = OS_CONFIGS[detectedOs];

  return (
    <div className="landing-scope">
      {/* External Web Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap"
      />

      <style jsx global>{`
        :root {
          --lp-bg: #fff;
          --lp-bg2: #f8fafc;
          --lp-line: #e2e8f0;
          --lp-line2: #cbd5e1;
          --lp-ink: #0f172a;
          --lp-muted: #475569;
          --lp-faint: #64748b;
          --lp-accent: #1d4ed8;
          --lp-accent-h: #1e40af;
          --lp-sel: #eff6ff;
          --lp-sans: 'Plus Jakarta Sans', system-ui, sans-serif;
          --lp-mono: 'JetBrains Mono', ui-monospace, monospace;
        }

        .landing-scope {
          font-family: var(--lp-sans);
          background: var(--lp-bg);
          color: var(--lp-ink);
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
          min-height: 100vh;
        }

        .landing-scope * {
          box-sizing: border-box;
        }

        .landing-scope a {
          color: inherit;
          text-decoration: none;
        }

        .landing-scope .wrap {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 1.5rem;
        }

        .landing-scope :focus-visible {
          outline: 2px solid var(--lp-accent);
          outline-offset: 2px;
        }

        .landing-scope header {
          border-bottom: 1px solid var(--lp-line);
        }

        .landing-scope .nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 3.75rem;
        }

        .landing-scope .brand {
          font-weight: 800;
          font-size: 1.1rem;
          letter-spacing: -0.02em;
        }

        .landing-scope .brand span {
          color: var(--lp-accent);
        }

        .landing-scope .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-family: var(--lp-sans);
          font-size: 0.85rem;
          font-weight: 700;
          padding: 0.6rem 1rem;
          border: 1px solid var(--lp-line2);
          border-radius: 6px;
          background: #fff;
          color: var(--lp-ink);
          cursor: pointer;
          text-decoration: none;
        }

        .landing-scope .btn:hover {
          background: var(--lp-bg2);
          border-color: #94a3b8;
        }

        .landing-scope .btn.solid {
          background: var(--lp-accent);
          border-color: transparent;
          color: #fff;
        }

        .landing-scope .btn.solid:hover {
          background: var(--lp-accent-h);
        }

        .landing-scope .hero {
          padding: 4.5rem 0 4rem;
        }

        .landing-scope .hero-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3.5rem;
          align-items: center;
        }

        .landing-scope .tag {
          display: inline-block;
          font-family: var(--lp-mono);
          font-weight: 700;
          font-size: 0.75rem;
          color: var(--lp-accent);
          background: var(--lp-sel);
          border: 1px solid #bfdbfe;
          padding: 0.2rem 0.6rem;
          border-radius: 4px;
          margin-bottom: 1.2rem;
        }

        .landing-scope h1 {
          font-size: clamp(2.3rem, 4.6vw, 3.5rem);
          font-weight: 800;
          line-height: 1.08;
          letter-spacing: -0.03em;
          margin-bottom: 1.1rem;
        }

        .landing-scope .lead {
          font-size: 1.05rem;
          color: var(--lp-muted);
          max-width: 30rem;
          margin-bottom: 1.8rem;
        }

        .landing-scope .dl {
          border: 1px solid var(--lp-line2);
          border-radius: 8px;
          padding: 1.1rem;
          max-width: 31rem;
          background: var(--lp-bg2);
        }

        .landing-scope .dl-top {
          display: flex;
          justify-content: space-between;
          font-family: var(--lp-mono);
          font-weight: 500;
          font-size: 0.72rem;
          color: var(--lp-faint);
          margin-bottom: 0.7rem;
        }

        .landing-scope .dl .btn.solid {
          width: 100%;
          justify-content: space-between;
          padding: 0.85rem 1rem;
          font-size: 0.95rem;
          text-align: left;
        }

        .landing-scope .dl small {
          display: block;
          font-weight: 500;
          font-size: 0.72rem;
          opacity: 0.85;
        }

        .landing-scope .dl p {
          font-size: 0.78rem;
          color: var(--lp-muted);
          margin-top: 0.8rem;
        }

        .landing-scope .dl .alt {
          margin-top: 0.5rem;
        }

        .landing-scope .dl .alt a {
          color: var(--lp-accent);
          font-weight: 600;
        }

        .landing-scope .dl .alt a:hover {
          text-decoration: underline;
        }

        /* Mockup */
        .landing-scope .win {
          background: #0f172a;
          color: #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
          font-family: var(--lp-mono);
          box-shadow: 0 20px 40px -12px rgba(15, 23, 42, 0.3);
        }

        .landing-scope .win-h {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.55rem 0.85rem;
          background: #1e293b;
          font-size: 0.64rem;
          color: #94a3b8;
          gap: 0.5rem;
        }

        .landing-scope .win-h .on {
          color: #4ade80;
          font-weight: 700;
        }

        .landing-scope .win-b {
          padding: 1rem;
        }

        .landing-scope .tot {
          background: #2f5fe8;
          color: #fff;
          padding: 0.8rem 0.9rem;
          border-radius: 5px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.9rem;
        }

        .landing-scope .tot span {
          font-size: 0.68rem;
          font-weight: 700;
        }

        .landing-scope .tot b {
          font-size: 1.5rem;
          font-weight: 700;
        }

        .landing-scope table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.7rem;
          margin-bottom: 0.9rem;
        }

        .landing-scope th {
          text-align: left;
          color: #64748b;
          font-weight: 500;
          padding: 0.3rem 0.4rem;
          border-bottom: 1px solid #334155;
        }

        .landing-scope td {
          padding: 0.45rem 0.4rem;
          border-bottom: 1px solid #1e293b;
        }

        .landing-scope .r {
          text-align: right;
        }

        .landing-scope tbody tr {
          animation: rowin 0.35s ease both;
        }

        @keyframes rowin {
          from {
            opacity: 0;
            background: #1a2a52;
          }
        }

        .landing-scope .keys {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.4rem;
          font-size: 0.62rem;
          text-align: center;
        }

        .landing-scope .keys div {
          background: #1e293b;
          border-radius: 4px;
          padding: 0.4rem 0.2rem;
          transition: 0.15s;
        }

        .landing-scope .keys b {
          color: #8fb0ff;
        }

        .landing-scope .keys div.hit {
          background: #2f5fe8;
          color: #fff;
        }

        .landing-scope .keys div.hit b {
          color: #fff;
        }

        .landing-scope .paid {
          height: 1.3rem;
          margin-top: 0.7rem;
          font-size: 0.7rem;
          color: #4ade80;
          font-weight: 700;
        }

        .landing-scope section {
          padding: 4.5rem 0;
          border-top: 1px solid var(--lp-line);
        }

        .landing-scope .sh {
          margin-bottom: 2.2rem;
        }

        .landing-scope h2 {
          font-size: clamp(1.6rem, 3vw, 2.1rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.15;
          margin-bottom: 0.5rem;
        }

        .landing-scope .sh p {
          color: var(--lp-muted);
          max-width: 34rem;
        }

        .landing-scope .feat {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .landing-scope .card {
          border: 1px solid var(--lp-line);
          border-radius: 8px;
          padding: 1.4rem;
          background: #fff;
        }

        .landing-scope .card h3 {
          font-size: 1.05rem;
          font-weight: 800;
          margin-bottom: 0.4rem;
        }

        .landing-scope .card p {
          color: var(--lp-muted);
          font-size: 0.92rem;
        }

        .landing-scope .dsec {
          background: var(--lp-bg2);
        }

        .landing-scope .tabs {
          display: flex;
          gap: 0.4rem;
          margin-bottom: 1rem;
        }

        .landing-scope .tab {
          font: 700 0.85rem var(--lp-sans);
          padding: 0.5rem 1.1rem;
          border: 1px solid var(--lp-line2);
          border-radius: 6px;
          background: #fff;
          color: var(--lp-muted);
          cursor: pointer;
        }

        .landing-scope .tab[aria-selected="true"] {
          border-color: var(--lp-accent);
          background: var(--lp-sel);
          color: var(--lp-accent);
        }

        .landing-scope .panel {
          display: none;
          background: #fff;
          border: 1px solid var(--lp-line);
          border-radius: 8px;
          padding: 1.6rem;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }

        .landing-scope .panel.on {
          display: grid;
        }

        .landing-scope .panel h3 {
          font-size: 1.2rem;
          font-weight: 800;
          margin-bottom: 0.4rem;
        }

        .landing-scope .panel p {
          color: var(--lp-muted);
          font-size: 0.92rem;
          margin-bottom: 1rem;
        }

        .landing-scope .files {
          font: 500 0.76rem var(--lp-mono);
          color: var(--lp-muted);
          border: 1px solid var(--lp-line);
          border-radius: 6px;
          padding: 0.8rem 0.9rem;
          background: var(--lp-bg2);
        }

        .landing-scope .files b {
          display: block;
          margin-bottom: 0.3rem;
          color: var(--lp-ink);
        }

        .landing-scope .files li {
          list-style: none;
          padding: 0.1rem 0;
        }

        .landing-scope .links {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          justify-content: center;
        }

        .landing-scope .lnk {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          border: 1px solid var(--lp-line2);
          border-radius: 6px;
          padding: 0.8rem 1rem;
          font-weight: 700;
          font-size: 0.9rem;
          background: #fff;
        }

        .landing-scope .lnk:hover {
          border-color: var(--lp-accent);
          color: var(--lp-accent);
        }

        .landing-scope .lnk span {
          font: 500 0.72rem var(--lp-mono);
          color: var(--lp-faint);
        }

        .landing-scope .lnk.f {
          background: var(--lp-accent);
          border-color: transparent;
          color: #fff;
        }

        .landing-scope .lnk.f span {
          color: #bfdbfe;
        }

        .landing-scope .lnk.f:hover {
          background: var(--lp-accent-h);
          color: #fff;
        }

        .landing-scope .steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }

        .landing-scope .n {
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          background: var(--lp-accent);
          color: #fff;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.8rem;
        }

        .landing-scope .step h3 {
          font-size: 1.05rem;
          font-weight: 800;
          margin-bottom: 0.3rem;
        }

        .landing-scope .step p {
          color: var(--lp-muted);
          font-size: 0.92rem;
        }

        .landing-scope footer {
          border-top: 1px solid var(--lp-line);
          padding: 2rem 0;
          font-size: 0.85rem;
          color: var(--lp-muted);
        }

        .landing-scope .foot {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: center;
        }

        .landing-scope .foot nav {
          display: flex;
          gap: 1.3rem;
          flex-wrap: wrap;
        }

        .landing-scope .foot a:hover {
          color: var(--lp-accent);
        }

        @media (max-width: 860px) {
          .landing-scope .hero-grid,
          .landing-scope .feat,
          .landing-scope .steps {
            grid-template-columns: 1fr;
          }
          .landing-scope .panel.on {
            grid-template-columns: 1fr;
            gap: 1.2rem;
          }
          .landing-scope .hero {
            padding-top: 3rem;
          }
          .landing-scope section {
            padding: 3.5rem 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .landing-scope * {
            animation: none !important;
            transition: none !important;
            scroll-behavior: auto;
          }
        }
      `}</style>

      {/* Header */}
      <header>
        <div className="wrap nav">
          <Link className="brand" href="#">
            ILuvBesi <span>POS</span>
          </Link>
          {isLoggedIn ? (
            <Link href="/dashboard" className="btn solid">
              Buka Dashboard
            </Link>
          ) : (
            <Link href="/login" className="btn">
              Dashboard Owner
            </Link>
          )}
        </div>
      </header>

      {/* Hero */}
      <div className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="tag">v1.1.1 stabil, multi-tenant</span>
            <h1>Kasir secepat ketikan, untuk toko besi &amp; baja.</h1>
            <p className="lead">
              Dirancang khusus untuk transaksi pipa hollow, plat baja, dan besi
              beton. Operasional 100% lewat papan ketik tanpa sentuh mouse, stok
              terpotong riil, dan terisolasi per toko.
            </p>
            <div className="dl">
              <div className="dl-top">
                <span>{currentOsCfg.label}</span>
                <span>{currentOsCfg.ver}</span>
              </div>
              <a
                className="btn solid"
                href={currentOsCfg.downloadUrl}
              >
                <div>
                  <span>{currentOsCfg.btnText}</span>
                  <small>{currentOsCfg.btnSub}</small>
                </div>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" />
                </svg>
              </a>
              <p>
                Paket instalasi menyertakan{" "}
                <strong>PANDUAN-INSTALASI-DAN-PENGGUNAAN.txt</strong> berisi petunjuk
                lengkap shortcut kasir F1-F12 dan panduan operasional.
              </p>
              <div className="alt">
                <a href="#unduh">Sistem operasi lain atau Android APK? Lihat semua unduhan</a>
              </div>
            </div>
          </div>

          <div className="win" aria-label="Pratinjau antarmuka kasir">
            <div className="win-h">
              <span>ILuvBesi POS Desktop v1.1.1 [Kasir: Budi - Shift Aktif]</span>
              <span className="on">ONLINE</span>
            </div>
            <div className="win-b">
              <div className="tot">
                <span>Total Tagihan [F7]</span>
                <b>Rp {runningTotal.toLocaleString("id-ID")}</b>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Item / Barang</th>
                    <th>Qty</th>
                    <th className="r">Harga</th>
                    <th className="r">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {cartItems.map((r, i) => (
                    <tr key={i}>
                      <td>{r.name}</td>
                      <td>{r.qty}</td>
                      <td className="r">{r.price}</td>
                      <td className="r">{r.subtotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="keys">
                <div className={activeKey === "f1" ? "hit" : ""}>
                  <b>[F1]</b> Cari
                </div>
                <div className={activeKey === "f7" ? "hit" : ""}>
                  <b>[F7]</b> Bayar
                </div>
                <div className={activeKey === "f8" ? "hit" : ""}>
                  <b>[F8]</b> Pelanggan
                </div>
                <div>
                  <b>[Esc]</b> Tutup Kasir
                </div>
              </div>
              <div className="paid">{paidStatus}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <section>
        <div className="wrap">
          <div className="sh">
            <h2>Dibuat untuk kebutuhan toko besi</h2>
            <p>
              Bukan software kasir ritel umum. Disesuaikan dengan alur barang
              material dan piutang kontraktor.
            </p>
          </div>
          <div className="feat">
            <div className="card">
              <h3>100% navigasi keyboard</h3>
              <p>
                Tombol fungsi F1 sampai F11 memungkinkan kasir mengetik nomor nota,
                mencari hollow, dan mencetak faktur dalam hitungan detik tanpa
                menyentuh mouse.
              </p>
            </div>
            <div className="card">
              <h3>Katalog batang &amp; tebal</h3>
              <p>
                Manajemen dimensi pipa dan ketebalan milimeter presisi. Harga modal
                HPP terhitung otomatis dengan moving average.
              </p>
            </div>
            <div className="card">
              <h3>Cicilan &amp; piutang kredit</h3>
              <p>
                Transaksi KREDIT dengan uang muka (DP), limit piutang per
                pelanggan, histori faktur, dan modul pelunasan cicilan terpadu.
              </p>
            </div>
            <div className="card">
              <h3>Buka &amp; tutup kasir (shift)</h3>
              <p>
                Kasir menginput modal awal laci saat buka toko. Saat tutup, sistem
                menampilkan rekapitulasi vertikal penjualan.
              </p>
            </div>
            <div className="card" style={{ borderColor: '#3b82f6', background: '#eff6ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <h3 style={{ color: '#1e3a8a', margin: 0 }}>Dashboard Mobile Android</h3>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, background: '#1e3a8a', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                  BARU v1.1.1
                </span>
              </div>
              <p style={{ color: '#1e40af', marginBottom: '0.8rem' }}>
                Khusus pemilik toko: pantau omzet realtime, riwayat nota kasir, ubah stok &amp; HPP, dan catat cicilan piutang langsung dari smartphone Android.
              </p>
              <a
                href={GITHUB_MOBILE_APK}
                className="btn solid"
                style={{ fontSize: '0.8rem', padding: '0.5rem 0.8rem', width: 'fit-content' }}
              >
                Unduh Dashboard Mobile APK (.apk)
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Downloads */}
      <section className="dsec" id="unduh">
        <div className="wrap">
          <div className="sh">
            <h2>Unduh untuk semua sistem operasi</h2>
            <p>
              Tersedia aplikasi desktop kasir untuk Windows, Linux, macOS, dan aplikasi mobile dashboard pemilik toko untuk Android.
            </p>
          </div>
          <div className="tabs" role="tablist">
            <button
              className="tab"
              role="tab"
              aria-selected={activeTab === "win"}
              onClick={() => setActiveTab("win")}
            >
              Windows
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={activeTab === "linux"}
              onClick={() => setActiveTab("linux")}
            >
              Linux
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={activeTab === "mac"}
              onClick={() => setActiveTab("mac")}
            >
              macOS
            </button>
            <button
              className="tab"
              role="tab"
              aria-selected={activeTab === "android"}
              onClick={() => setActiveTab("android")}
            >
              Android (Mobile APK)
            </button>
          </div>

          <div className={`panel ${activeTab === "win" ? "on" : ""}`} role="tabpanel">
            <div>
              <h3>Windows 10 / 11</h3>
              <p>
                Arsip installer untuk PC kasir berbasis Windows 64-bit. Mendukung
                instalasi cepat NSIS dan Windows Installer standar.
              </p>
              <div className="files">
                <b>Isi paket .ZIP</b>
                <ul>
                  <li>ILuvBesi POS Setup .exe (NSIS)</li>
                  <li>ILuvBesi POS Setup .msi</li>
                  <li>PANDUAN-INSTALASI-DAN-PENGGUNAAN.txt</li>
                </ul>
              </div>
            </div>
            <div className="links">
              <a
                className="lnk f"
                href={`${GITHUB_DESKTOP_BASE}ILoveBesi-POS-Windows-64bit.zip`}
              >
                Unduh Paket Windows (.zip)<span>64-bit (v1.1.1)</span>
              </a>
            </div>
          </div>

          <div
            className={`panel ${activeTab === "linux" ? "on" : ""}`}
            role="tabpanel"
          >
            <div>
              <h3>Distro Linux</h3>
              <p>
                Paket native untuk distribusi Linux modern. Siap jalan di workstation
                toko dengan performa memori ultra-ringan.
              </p>
              <div className="files">
                <b>Isi tiap paket .ZIP</b>
                <ul>
                  <li>Berkas biner installer (.rpm, .deb, atau .AppImage)</li>
                  <li>PANDUAN-INSTALASI-DAN-PENGGUNAAN.txt</li>
                </ul>
              </div>
            </div>
            <div className="links">
              <a
                className="lnk"
                href={`${GITHUB_DESKTOP_BASE}ILoveBesi-POS-Linux-RPM.zip`}
              >
                Fedora / RHEL<span>.rpm .zip</span>
              </a>
              <a
                className="lnk"
                href={`${GITHUB_DESKTOP_BASE}ILoveBesi-POS-Linux-DEB.zip`}
              >
                Ubuntu / Debian<span>.deb .zip</span>
              </a>
              <a
                className="lnk"
                href={`${GITHUB_DESKTOP_BASE}ILoveBesi-POS-Linux-AppImage.zip`}
              >
                Universal Portable<span>.AppImage .zip</span>
              </a>
            </div>
          </div>

          <div className={`panel ${activeTab === "mac" ? "on" : ""}`} role="tabpanel">
            <div>
              <h3>macOS Apple</h3>
              <p>
                Berkas disk image (.dmg) native untuk laptop atau komputer Mac
                pemilik toko, teroptimasi untuk chip Apple Silicon dan Intel.
              </p>
              <div className="files">
                <b>Isi tiap paket .ZIP</b>
                <ul>
                  <li>Berkas disk image installer (.dmg)</li>
                  <li>PANDUAN-INSTALASI-DAN-PENGGUNAAN.txt</li>
                </ul>
              </div>
            </div>
            <div className="links">
              <a
                className="lnk"
                href={`${GITHUB_DESKTOP_BASE}ILoveBesi-POS-macOS-Apple-Silicon.zip`}
              >
                Apple Silicon (M1/M2/M3/M4)<span>.dmg .zip</span>
              </a>
              <a
                className="lnk"
                href={`${GITHUB_DESKTOP_BASE}ILoveBesi-POS-macOS-Intel.zip`}
              >
                Intel Mac<span>.dmg .zip</span>
              </a>
            </div>
          </div>

          <div
            className={`panel ${activeTab === "android" ? "on" : ""}`}
            role="tabpanel"
          >
            <div>
              <h3>ILuvBesi Mobile untuk Android</h3>
              <p>
                Aplikasi dashboard khusus pemilik toko (owner) berbasis Android. Pantau omzet realtime,
                riwayat nota penjualan kasir, ubah stok gudang &amp; HPP barang, dan pantau tagihan tempo piutang langsung dari smartphone Anda.
              </p>
              <div className="files">
                <b>Spesifikasi Berkas Android</b>
                <ul>
                  <li>Format Paket: Berkas Instalasi Mandiri (.APK)</li>
                  <li>Versi Rilis: v1.1.1 Standalone APK</li>
                  <li>Kompatibilitas: Android 8.0 (Oreo) ke atas</li>
                  <li>Fitur: Sinkronisasi database Supabase realtime, tanpa perantara server</li>
                </ul>
              </div>
            </div>
            <div className="links">
              <a
                className="lnk f"
                href={GITHUB_MOBILE_APK}
              >
                Unduh ILuvBesi Mobile (.APK)<span>v1.1.1 .apk</span>
              </a>
              <a
                className="lnk"
                href="https://github.com/kikiexe/ILoveBesi-mobile/releases"
                target="_blank"
                rel="noopener"
              >
                Halaman Rilis GitHub Mobile<span>Semua Rilis APK</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section>
        <div className="wrap">
          <div className="sh">
            <h2>3 langkah mudah memulai</h2>
          </div>
          <div className="steps">
            <div className="step">
              <div className="n">1</div>
              <h3>Ekstrak file .ZIP</h3>
              <p>
                Klik kanan file .zip yang telah diunduh, pilih Extract All (Ekstrak
                Semua). Buka file panduan teks jika muncul pesan Microsoft
                Defender SmartScreen.
              </p>
            </div>
            <div className="step">
              <div className="n">2</div>
              <h3>Login akun toko</h3>
              <p>
                Buka aplikasi, masukkan email dan password toko Anda. Seluruh
                katalog barang, harga jual, dan stok otomatis tersinkronisasi.
              </p>
            </div>
            <div className="step">
              <div className="n">3</div>
              <h3>Buka kasir &amp; transaksi</h3>
              <p>
                Ketik nama kasir jaga dan uang modal awal di laci kasir. Tekan
                [Enter] untuk membuka meja kasir dan mulai melayani dengan pintasan
                F1-F12.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="wrap foot">
          <div>
            <strong>ILuvBesi POS</strong> - Sistem kasir &amp; manajemen toko besi
            hollow galvanis.
          </div>
          <nav>
            <Link href="/login">Login Dashboard Pemilik</Link>
            <a
              href="/PANDUAN-INSTALASI-DAN-PENGGUNAAN.txt"
              target="_blank"
              rel="noopener"
            >
              Panduan Instalasi
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
