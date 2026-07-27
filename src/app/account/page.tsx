import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/shared/container";
import { AccountData } from "@/components/account/account-data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Your account",
  description: "Export or delete the data Enki holds about you.",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/account");

  return (
    <Container className="pt-28 pb-20">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">
            Account
          </p>
          <h1 className="text-balance font-display text-4xl font-semibold">
            Your data
          </h1>
          <p className="text-pretty text-muted-foreground">
            Signed in as {user.email}. You can take a copy of everything we hold
            about you, or remove it entirely.
          </p>
        </header>

        <AccountData email={user.email ?? "your account"} />
      </div>
    </Container>
  );
}
