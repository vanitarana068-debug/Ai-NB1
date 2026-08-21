export type Review = {
  id: string;
  author: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  verified: boolean;
  helpful: number;
};

const pool: Omit<Review, "id">[] = [
  {
    author: "Marcus D.",
    rating: 5,
    date: "12 June 2026",
    title: "Genuinely fast, and the battery holds up",
    body: "Two weeks in and it still ends the day above 40% with heavy camera use. Build quality is a step up from my previous handset, and the display brightness outdoors is the real upgrade.",
    verified: true,
    helpful: 42,
  },
  {
    author: "Priya S.",
    rating: 4,
    date: "3 June 2026",
    title: "Excellent, minor niggles",
    body: "Performance is exactly as advertised and it stays cool under sustained load. The bundled charger is slower than I expected, so budget for a faster one if you top up quickly.",
    verified: true,
    helpful: 27,
  },
  {
    author: "Tom R.",
    rating: 5,
    date: "28 May 2026",
    title: "Worth the upgrade from a three-year-old model",
    body: "Benchmarks aside, the difference is obvious in everyday use: exports finish faster and the fans barely spin up. Delivery arrived a day earlier than estimated.",
    verified: true,
    helpful: 19,
  },
  {
    author: "Elena K.",
    rating: 4,
    date: "19 May 2026",
    title: "Great value for the specification",
    body: "Nothing here feels cut back for the price. I compared three alternatives on this site and this had the best display for the money.",
    verified: false,
    helpful: 11,
  },
  {
    author: "Daniel A.",
    rating: 3,
    date: "6 May 2026",
    title: "Good product, packaging was tight",
    body: "The hardware is solid and does everything I need. Half a star off because the box arrived slightly crushed, though the contents were fine and support responded within an hour.",
    verified: true,
    helpful: 8,
  },
];

export function reviewsFor(slug: string, count = 5): Review[] {
  return pool.slice(0, count).map((r, i) => ({ ...r, id: `${slug}-r${i}` }));
}

export function ratingDistribution(rating: number, total: number) {
  const base = [0.68, 0.2, 0.07, 0.03, 0.02];
  const shift = Math.max(0, Math.min(1, (rating - 3.8) / 1.2));
  const weights = base.map(
    (b, i) => b * (i === 0 ? 0.7 + shift * 0.6 : 1 + (1 - shift) * i * 0.25),
  );
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w, i) => ({ stars: 5 - i, count: Math.round((w / sum) * total) }));
}
