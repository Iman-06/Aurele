export type CuratedTile = {
  id: string;
  /** Small-caps line above the title. */
  label: string;
  title: string;
  href: string;
  /** Path under /public. A dark panel is used when the file is missing. */
  image: string;
  /** Homepage category row: hide the tile until this category has a listed product. */
  category?: string;
  /** Hide this tile unless the catalog list query accepts this field. */
  requiresFilter?: string;
};

export const ELEGANCE_TILES: CuratedTile[] = [
  {
    id: "elegance-earrings",
    label: "Earrings",
    title: "Earrings",
    href: "/earrings",
    image: "/tiles/elegance-earrings.jpg",
    category: "earrings",
  },
  {
    id: "elegance-rings",
    label: "Rings",
    title: "Rings",
    href: "/rings",
    image: "/tiles/elegance-rings.jpg",
    category: "rings",
  },
  {
    id: "elegance-necklace",
    label: "Necklace",
    title: "Necklace",
    href: "/necklaces",
    image: "/tiles/elegance-necklace.jpg",
    category: "necklaces",
  },
  {
    id: "elegance-bracelets",
    label: "Bracelets",
    title: "Bracelets",
    href: "/bracelets",
    image: "/tiles/elegance-bracelet.jpg",
    category: "bracelets",
  },
];

export const CURATED_TILES: CuratedTile[] = [
  {
    id: "new-arrivals",
    label: "New",
    title: "New Arrivals",
    href: "/new-arrivals",
    image: "/tiles/tile-new-arrivals.jpg",
  },
  {
    id: "one-of-a-kind",
    label: "One of a kind",
    title: "One of a Kind",
    href: "/one-of-a-kind",
    image: "/tiles/tile-one-of-a-kind.jpg",
    requiresFilter: "oneOfAKind",
  },
];
