import { cn } from "@/lib/utils";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

/**
 * Orb do assistente: anéis concêntricos girando + núcleo pulsante.
 * A velocidade/cor muda conforme o estado (ouvindo, pensando, falando).
 */
export function JarvisOrb({ state = "idle", size = 160 }: { state?: OrbState; size?: number }) {
  const ring = state === "thinking" ? "animate-spin-fast" : "animate-spin-slow";
  const color = state === "listening" ? "text-danger" : "text-primary";

  return (
    <div className={cn("relative", color)} style={{ width: size, height: size }} aria-hidden>
      <div className="absolute inset-0 rounded-full bg-current opacity-10 blur-2xl" />
      <svg viewBox="0 0 200 200" className={cn("absolute inset-0", ring)}>
        <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeOpacity=".5" strokeWidth="1" strokeDasharray="2 6" />
        <path d="M100 6 A94 94 0 0 1 194 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M100 194 A94 94 0 0 1 6 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <svg viewBox="0 0 200 200" className="absolute inset-0 animate-spin-rev">
        <circle cx="100" cy="100" r="74" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="6" strokeDasharray="1 9" />
        <path d="M30 100 A70 70 0 0 1 100 30" fill="none" stroke="currentColor" strokeOpacity=".8" strokeWidth="1.5" />
      </svg>
      <svg viewBox="0 0 200 200" className="absolute inset-0">
        <circle cx="100" cy="100" r="54" fill="none" stroke="currentColor" strokeOpacity=".6" strokeWidth="1" />
        {Array.from({ length: 24 }).map((_, i) => (
          <line
            key={i}
            x1="100" y1="40" x2="100" y2={i % 6 === 0 ? 50 : 45}
            stroke="currentColor" strokeOpacity=".7" strokeWidth="1.2"
            transform={`rotate(${i * 15} 100 100)`}
          />
        ))}
      </svg>
      {/* Núcleo: centralizado por grid (a animação usa transform, então não dá para centralizar com translate) */}
      <div className="absolute inset-0 grid place-items-center">
        <div
          className={cn("h-[30%] w-[30%] rounded-full bg-current", state === "speaking" ? "animate-pulse" : "animate-core")}
          style={{ boxShadow: "0 0 30px currentColor, 0 0 70px currentColor" }}
        />
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <div className="h-[16%] w-[16%] rounded-full bg-white/90 blur-[2px]" />
      </div>
    </div>
  );
}
