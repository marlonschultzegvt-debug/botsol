/**
 * Provedores de mídia por IA (fase 2). Ficam desativados até as chaves serem configuradas.
 * Imagem: OPENAI_API_KEY ou IDEOGRAM_API_KEY. Reels: ELEVENLABS_API_KEY + PEXELS_API_KEY + SHOTSTACK_API_KEY.
 */
export const imageProviderConfigured = () => Boolean(process.env.OPENAI_API_KEY || process.env.IDEOGRAM_API_KEY);
export const reelProviderConfigured = () =>
  Boolean(process.env.ELEVENLABS_API_KEY && process.env.PEXELS_API_KEY && process.env.SHOTSTACK_API_KEY);
