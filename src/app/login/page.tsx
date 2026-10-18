"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const supabase = createClient();

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError || !authData.user) {
        setErrorMessage(authError?.message || "Email atau password salah.");
        setIsLoading(false);
        return;
      }

      /* Verify user role in public.profiles, auto-provisioning owner profile if missing */
      let userRole = "owner";
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (!profile) {
        const fallbackName =
          (authData.user.user_metadata?.full_name as string) ||
          authData.user.email?.split("@")[0] ||
          "Owner Toko";
        const { error: insertError } = await supabase.from("profiles").insert({
          id: authData.user.id,
          role: "owner",
          full_name: fallbackName,
        });
        if (insertError) {
          const { data: reProfile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", authData.user.id)
            .maybeSingle();
          if (reProfile) userRole = reProfile.role;
        }
      } else {
        userRole = profile.role;
      }

      if (userRole !== "owner") {
        await supabase.auth.signOut();
        setErrorMessage("Akses ditolak: Akun kasir hanya dapat digunakan pada Aplikasi Desktop Kasir.");
        setIsLoading(false);
        return;
      }

      /* Successfully verified as owner */
      router.push("/");
      router.refresh();
    } catch {
      setErrorMessage("Terjadi kesalahan jaringan saat mencoba masuk.");
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-md border border-slate-300 bg-white p-6 shadow-sm">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">ILoveBesi</h1>
          <p className="text-sm font-medium text-slate-700">Masuk Dashboard Pemilik Toko</p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-4 rounded border border-red-300 bg-red-100 p-3 text-sm text-red-800"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-900">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@toko.com"
              className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-900">
              Kata Sandi
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan kata sandi"
              className="h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="h-10 w-full rounded bg-blue-900 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
          >
            {isLoading ? "Memeriksa Akun..." : "Masuk ke Dashboard"}
          </button>
        </form>
      </div>
    </main>
  );
}
