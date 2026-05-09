import { AuthButton } from "@/components/auth-button";
import { Suspense } from "react";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d0d14] text-white">
      {/* Top Nav */}
      <nav className="border-b border-white/10 bg-white/5 backdrop-blur px-6 py-3 flex items-center justify-between">
        <span className="font-bold text-lg tracking-tight">Teacher Assistant</span>
        <Suspense>
          <AuthButton />
        </Suspense>
      </nav>

      {/* Page Content */}
      <main className="w-full">{children}</main>
    </div>
  );
}
