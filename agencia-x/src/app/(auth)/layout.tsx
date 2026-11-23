import { JarvisOrb } from "@/components/jarvis/jarvis-orb";
import { AGENCY_NAME } from "@/lib/utils";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <JarvisOrb size={96} />
          <p className="font-mono text-sm tracking-[0.35em] text-primary text-glow">{AGENCY_NAME.toUpperCase()}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
