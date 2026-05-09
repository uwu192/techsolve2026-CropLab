import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/protected");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#0d0d14] text-white px-6">
      <div className="w-full max-w-md text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Teacher Assistant</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Sign in with the Google account you use for Classroom. You&apos;ll go straight to
            the dashboard to run the grading pipeline.
          </p>
        </div>

        <form action={signInWithGoogle}>
          <Button
            type="submit"
            size="lg"
            className="w-full bg-white text-gray-900 hover:bg-gray-100 font-medium"
          >
            Continue with Google
          </Button>
        </form>

        <p className="text-xs text-muted-foreground">
          Uses Google Classroom and Drive access you approve on the next screen.
        </p>
      </div>
    </main>
  );
}
