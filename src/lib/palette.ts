// The display palette for the periods — one historical pigment per movement,
// normalized to a single tonal band (mid lightness, moderate chroma) so the
// nineteen strata read as one engraved plate instead of nineteen competing
// colors. Display truth lives here; the `accent` in data/json/timeline.json
// (seeded by pipeline/seed-data.ts) is only a fallback for unknown slugs.
//
// Verified against the paper ground (#f1ebdc): ink on a 30% tint of every
// pigment stays above 7.7:1 contrast.

export const PERIOD_PIGMENTS: Record<string, string> = {
  "medieval-gothic": "#41519c", // lapis ultramarine, the illuminator's blue
  "early-renaissance": "#a85a3f", // fresco terracotta
  "northern-renaissance": "#4e6b45", // copper resinate, van Eyck's deep green
  "high-renaissance": "#9c4038", // Venetian red
  mannerism: "#8a5f93", // Pontormo's shot-silk violet
  baroque: "#6b4b2a", // raw umber, the tenebrist ground
  rococo: "#b26a7c", // rose Pompadour
  neoclassicism: "#5b7286", // Wedgwood slate blue
  romanticism: "#6a5a86", // twilight mauve
  realism: "#7a6248", // ploughed-earth ochre
  impressionism: "#8a63ad", // cobalt violet, newly bottled in the Salon era
  "post-impressionism": "#c2632f", // chrome orange
  "symbolism-art-nouveau": "#9d7a26", // Klimt's bronze gold
  expressionism: "#b23a30", // vermilion
  "cubism-abstraction": "#6d7258", // analytical olive-grey
  surrealism: "#4b4e94", // dream-deep indigo
  "abstract-expressionism": "#bf4d26", // cadmium red-orange
  "pop-art": "#bf4a78", // silkscreen magenta
  contemporary: "#3d7f96", // process cyan
};

// Single-word stand-ins for the compound-named periods, tried before the
// terse shorthand when a band has room for a real word.
export const PERIOD_MEDIUM: Record<string, string> = {
  "medieval-gothic": "Gothic",
  "symbolism-art-nouveau": "Symbolism",
  "cubism-abstraction": "Cubism",
};

// Catalogue shorthand lettered inside strata too narrow for the full name.
// Entries of ≤6 characters can also run vertically inside a 46px band.
export const PERIOD_SHORTHAND: Record<string, string> = {
  "medieval-gothic": "Gothic",
  "early-renaissance": "E.Ren.",
  "northern-renaissance": "N.Ren.",
  "high-renaissance": "H.Ren.",
  mannerism: "Mann.",
  baroque: "Baroq.",
  rococo: "Rococo",
  neoclassicism: "Neocl.",
  romanticism: "Romant.",
  realism: "Real.",
  impressionism: "Impr.",
  "post-impressionism": "P-Imp.",
  "symbolism-art-nouveau": "Symb.",
  expressionism: "Expr.",
  "cubism-abstraction": "Cubism",
  surrealism: "Surr.",
  "abstract-expressionism": "Ab-Ex",
  "pop-art": "Pop",
  contemporary: "Cont.",
};

/** Display pigment for a period; the gilt tone when the slug is unknown. */
export function pigmentOf(periodSlug: string, fallback = "#96742f"): string {
  return PERIOD_PIGMENTS[periodSlug] ?? fallback;
}
