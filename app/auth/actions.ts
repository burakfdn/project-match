"use server";

import { createClient } from "@/lib/supabase/server";

export async function logout(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: "Çıkış yapılamadı. Tekrar dene." };
  }

  return { error: null };
}
