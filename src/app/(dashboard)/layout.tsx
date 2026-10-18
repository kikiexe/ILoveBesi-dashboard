import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/TopNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let profile = null;
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    const fallbackName =
      (user.user_metadata?.full_name as string) ||
      user.email?.split("@")[0] ||
      "Owner Toko";
    const { data: createdProfile } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        role: "owner",
        full_name: fallbackName,
      })
      .select("role, full_name")
      .single();

    profile = createdProfile || { role: "owner", full_name: fallbackName };
  } else {
    profile = existingProfile;
  }

  if (profile.role !== "owner") {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav userEmail={user.email} userName={profile.full_name} />
      <main className="mx-auto max-w-7xl p-4 pb-28 sm:p-6 sm:pb-6">{children}</main>
    </div>
  );
}
