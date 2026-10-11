import { Cardo, Petrona } from "next/font/google";

/** Shared storefront and admin faces. Cardo is body; Petrona is headings. */
export const cardo = Cardo({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-cardo",
  display: "swap",
});

export const petrona = Petrona({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-petrona",
  display: "swap",
});
