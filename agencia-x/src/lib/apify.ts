/**
 * Coletor de dados públicos do Instagram via Apify (actor oficial
 * "apify/instagram-profile-scraper"). Opcional: só roda se APIFY_TOKEN existir.
 * Devolve um resumo enxuto (não manda o JSON bruto inteiro para a IA = economiza tokens).
 */
type ApifyPost = {
  type?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  timestamp?: string;
};

type ApifyProfile = {
  username?: string;
  fullName?: string;
  biography?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  externalUrl?: string;
  latestPosts?: ApifyPost[];
};

export type ScrapedProfile = ReturnType<typeof summarize>;

export const apifyEnabled = () => Boolean(process.env.APIFY_TOKEN);

export async function scrapeInstagramProfile(handle: string) {
  const token = process.env.APIFY_TOKEN;
  if (!token) return null;

  const res = await fetch(
    "https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?timeout=90",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ usernames: [handle.replace(/^@/, "")] }),
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`Apify respondeu ${res.status}`);
  const items = (await res.json()) as ApifyProfile[];
  return items[0] ? summarize(items[0]) : null;
}

function summarize(p: ApifyProfile) {
  const posts = (p.latestPosts ?? []).slice(0, 12);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const avgLikes = avg(posts.map((x) => x.likesCount ?? 0));
  const avgComments = avg(posts.map((x) => x.commentsCount ?? 0));
  const followers = p.followersCount ?? 0;

  // Frequência: posts por semana com base no intervalo entre o mais novo e o mais antigo.
  const times = posts.map((x) => (x.timestamp ? Date.parse(x.timestamp) : NaN)).filter((n) => !isNaN(n));
  const spanWeeks = times.length > 1 ? (Math.max(...times) - Math.min(...times)) / (7 * 864e5) : 0;

  return {
    username: p.username,
    fullName: p.fullName,
    biography: p.biography,
    externalUrl: p.externalUrl,
    followers,
    following: p.followsCount,
    postsCount: p.postsCount,
    avgLikes: Math.round(avgLikes),
    avgComments: Math.round(avgComments),
    engagementRatePct: followers ? +(((avgLikes + avgComments) / followers) * 100).toFixed(2) : null,
    postsPerWeek: spanWeeks > 0 ? +(posts.length / spanWeeks).toFixed(1) : null,
    recentPosts: posts.map((x) => ({
      type: x.type,
      date: x.timestamp?.slice(0, 10),
      likes: x.likesCount,
      comments: x.commentsCount,
      views: x.videoViewCount,
      caption: x.caption?.slice(0, 280),
    })),
  };
}
