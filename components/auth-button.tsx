import Link from "next/link";
import { buttonVariants } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { cn } from "@/lib/utils";

export async function AuthButton() {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();

  const user = data?.claims;

  return user ? (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-muted-foreground truncate max-w-[200px]">{user.email}</span>
      <LogoutButton />
    </div>
  ) : (
    <Link href="/" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
      Sign in
    </Link>
  );
}
