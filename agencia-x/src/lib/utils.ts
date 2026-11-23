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
