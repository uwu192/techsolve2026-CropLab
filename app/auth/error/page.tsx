import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Suspense } from "react";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;
  const text = params?.message ?? params?.error;

  return (
    <p className="text-sm text-muted-foreground">
      {text ?? "Something went wrong during sign-in."}
    </p>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-[#0d0d14]">
      <div className="w-full max-w-sm">
        <Card className="border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle className="text-xl">Sign-in problem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
              <ErrorContent searchParams={searchParams} />
            </Suspense>
            <Link href="/" className={cn(buttonVariants({ className: "w-full" }))}>
              Back to sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
