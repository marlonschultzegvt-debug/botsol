import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Junta classes Tailwind resolvendo conflitos (padrão shadcn/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const ASSISTANT_NAME = process.env.NEXT_PUBLIC_ASSISTANT_NAME ?? "Jarvis";
export const AGENCY_NAME = process.env.NEXT_PUBLIC_AGENCY_NAME ?? "Agência X";

/**
 * Fuso fixo para datas exibidas em componentes client: o servidor (UTC) e o
 * navegador (Brasília) precisam gerar o MESMO texto, senão o React acusa erro de hidratação.
 */
export const TZ = process.env.NEXT_PUBLIC_TIMEZONE ?? "America/Sao_Paulo";
