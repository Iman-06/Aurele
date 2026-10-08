export type CuratedTile = {
  id: string;
  /** Small-caps line above the title. */
  label: string;
  title: string;
  href: string;
  /** Path under /public. A dark panel is used when the file is missing. */
  image: string;
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
  },
  {
    id: "elegance-rings",
    label: "Rings",
    title: "Rings",
    href: "/rings",
    image: "/tiles/elegance-rings.jpg",
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
