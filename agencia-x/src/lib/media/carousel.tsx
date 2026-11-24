/**
 * Renderizador de carrossel: transforma slides (título, texto) em JPEGs prontos para o Instagram,
 * com a identidade visual do cliente. Usa next/og (Satori + Resvg) no servidor — sem serviço externo,
 * sem custo por imagem — e o sharp para converter PNG → JPEG (o Instagram só aceita JPEG).
 */
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";

export type Slide = { titulo: string; texto?: string; visual?: string };
export type CarouselStyle = "impacto" | "clean" | "dark";
export type MediaFormat = "feed" | "quadrado" | "story";
export type Brand = {
  name: string;
  handle: string | null;
  primary: string;
  accent: string;
  bg: string;
  text: string;
  font: FontKey;
  logoDataUri: string | null;
};

export const FORMATS: Record<MediaFormat, { w: number; h: number; label: string }> = {
  feed: { w: 1080, h: 1350, label: "Feed 4:5 (1080×1350)" },
  quadrado: { w: 1080, h: 1080, label: "Quadrado (1080×1080)" },
  story: { w: 1080, h: 1920, label: "Stories/Reels 9:16 (1080×1920)" },
};

export const FONT_FILES = {
  montserrat: { label: "Montserrat", regular: "Montserrat-Regular.woff", bold: "Montserrat-ExtraBold.woff", boldWeight: 800 },
  poppins: { label: "Poppins", regular: "Poppins-Regular.ttf", bold: "Poppins-Bold.ttf", boldWeight: 700 },
  playfair: { label: "Playfair Display (serifada)", regular: "Playfair-Regular.woff", bold: "Playfair-Bold.woff", boldWeight: 700 },
  spacegrotesk: { label: "Space Grotesk", regular: "SpaceGrotesk-Regular.woff", bold: "SpaceGrotesk-Bold.woff", boldWeight: 700 },
} as const;
export type FontKey = keyof typeof FONT_FILES;

const fontCache = new Map<string, Buffer>();
async function loadFont(file: string) {
  if (!fontCache.has(file)) fontCache.set(file, await readFile(path.join(process.cwd(), "src/assets/fonts", file)));
  return fontCache.get(file)!;
}

// ── Cores ──
const hex = (c: string) => {
  const m = c.replace("#", "").match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return [0, 0, 0];
  const v = m[1].length === 3 ? m[1].split("").map((x) => x + x).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
};
const luminance = (c: string) => {
  const [r, g, b] = hex(c).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Texto legível sobre um fundo: usa a cor da marca se tiver contraste, senão preto/branco. */
const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const readableOn = (bg: string, preferred: string) => {
  if (contrast(bg, preferred) >= 4.5) return preferred;
  return luminance(bg) > 0.4 ? "#0B0F17" : "#FFFFFF";
};

/** Tamanho do título conforme o comprimento (cabe sem cortar). */
const titleSize = (t: string, cover: boolean, tall: boolean) => {
  const n = t.length;
  const base = cover ? (n <= 28 ? 104 : n <= 56 ? 86 : n <= 90 ? 70 : 58) : (n <= 32 ? 76 : n <= 64 ? 64 : 54);
  return tall ? Math.round(base * 1.3) : base;
};
const bodySize = (t: string, tall: boolean) => Math.round((t.length <= 120 ? 40 : t.length <= 200 ? 36 : 32) * (tall ? 1.3 : 1));

function palette(style: CarouselStyle, b: Brand) {
  if (style === "impacto") {
    const bg = b.primary;
    return { bg, fg: readableOn(bg, b.text), accent: b.accent, muted: readableOn(bg, b.text) };
  }
  if (style === "clean") {
    const bg = luminance(b.bg) > 0.6 ? b.bg : "#F6F4EF";
    // Destaque claro em fundo claro some: usa a cor principal no lugar.
    const accent = contrast(bg, b.accent) >= 3 ? b.accent : readableOn(bg, b.primary);
    return { bg, fg: readableOn(bg, b.primary), accent, muted: readableOn(bg, "#4B5563") };
  }
  const bg = "#0B0F17";
  return { bg, fg: "#F5F7FA", accent: b.accent, muted: "#AAB4C3" };
}

function SlideView({ s, i, total, brand, style, format }: { s: Slide; i: number; total: number; brand: Brand; style: CarouselStyle; format: MediaFormat }) {
  const { w, h } = FORMATS[format];
  const tall = format === "story";
  const pad = tall ? 110 : 96;
  const p = palette(style, brand);
  const cover = i === 0;
  const last = i === total - 1 && total > 2;
  const num = String(i + 1).padStart(2, "0");

  return (
    <div style={{ width: w, height: h, display: "flex", flexDirection: "column", background: p.bg, color: p.fg, padding: pad, fontFamily: "Brand", position: "relative" }}>
      {/* faixa de destaque */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 18, height: h, background: p.accent, display: "flex" }} />

      {/* topo: marca + contador */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: tall ? 38 : 30, color: p.muted, opacity: 0.85 }}>
        <span>{brand.handle ?? brand.name}</span>
        <span>{i + 1}/{total}</span>
      </div>

      {/* miolo */}
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: cover ? "center" : "center", gap: 36 }}>
        {!cover && !last && (
          <div style={{ display: "flex", fontSize: tall ? 150 : 120, fontWeight: 800, color: p.accent, lineHeight: 1 }}>{num}</div>
        )}
        <div style={{ display: "flex", fontSize: titleSize(s.titulo, cover, tall), fontWeight: 800, lineHeight: 1.08, letterSpacing: -1 }}>
          {s.titulo}
        </div>
        {cover && <div style={{ display: "flex", width: 160, height: 14, background: p.accent, borderRadius: 8 }} />}
        {s.texto && (
          <div style={{ display: "flex", fontSize: bodySize(s.texto, tall), lineHeight: 1.38, color: p.fg, opacity: 0.9, fontWeight: 400 }}>
            {s.texto}
          </div>
        )}
        {last && (
          <div style={{ display: "flex", alignSelf: "flex-start", marginTop: 10, background: p.accent, color: readableOn(p.accent, "#0B0F17"), fontSize: tall ? 46 : 36, fontWeight: 800, padding: "22px 40px", borderRadius: 999 }}>
            {brand.handle ? `Siga ${brand.handle}` : "Salve e compartilhe"}
          </div>
        )}
      </div>

      {/* rodapé: logo + chamada para arrastar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 72 }}>
        {brand.logoDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img src={brand.logoDataUri} height={tall ? 96 : 72} style={{ objectFit: "contain", maxWidth: 360 }} />
        ) : (
          <span style={{ fontSize: tall ? 44 : 34, fontWeight: 800 }}>{brand.name}</span>
        )}
        {!last && <span style={{ fontSize: tall ? 42 : 32, color: p.accent, fontWeight: 800 }}>{cover ? "Arraste →" : "→"}</span>}
      </div>
    </div>
  );
}

/** Renderiza todos os slides e devolve JPEGs (qualidade 90, sRGB). */
export async function renderCarousel(slides: Slide[], brand: Brand, style: CarouselStyle, format: MediaFormat): Promise<Buffer[]> {
  const f = FONT_FILES[brand.font] ?? FONT_FILES.montserrat;
  const [regular, bold] = await Promise.all([loadFont(f.regular), loadFont(f.bold)]);
  const { w, h } = FORMATS[format];
  const out: Buffer[] = [];
  for (let i = 0; i < slides.length; i++) {
    const res = new ImageResponse(<SlideView s={slides[i]} i={i} total={slides.length} brand={brand} style={style} format={format} />, {
      width: w,
      height: h,
      fonts: [
        { name: "Brand", data: regular, weight: 400, style: "normal" },
        { name: "Brand", data: bold, weight: f.boldWeight, style: "normal" },
      ],
    });
    const png = Buffer.from(await res.arrayBuffer());
    out.push(await sharp(png).flatten({ background: "#ffffff" }).jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer());
  }
  return out;
}
