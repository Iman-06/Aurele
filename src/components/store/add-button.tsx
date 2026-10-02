"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";
import type { ProductDetail } from "@/server/catalog/catalog";

/** Adds the only purchasable variant. If the detail turns out to have several, open the product page. */
export function AddButton({ slug }: { slug: string }) {
  const addItem = useCartStore((s) => s.addItem);
  const router = useRouter();
  const [state, setState] = useState<"idle" | "adding" | "added" | "error">("idle");

  async function add() {
    setState("adding");
    try {
      const res = await fetch(`/api/products/${slug}`);
      if (!res.ok) throw new Error("unavailable");
      const product = (await res.json()) as ProductDetail;
      const options = product.finishes.flatMap((finish) =>
        finish.colours.flatMap((colour) => colour.variants.map((variant) => ({ finish, colour, variant }))),
      );
      if (options.length !== 1) {
        router.push(`/products/${slug}`);
        return;
      }
      const { finish, colour, variant } = options[0];
      addItem({
        variantId: variant.variantId,
        productId: product.id,
        name: product.name,
        finish: finish.finish,
        colour: colour.colour,
        size: variant.size,
        photoRef: colour.images[0]?.url ?? product.images[0]?.url ?? null,
        priceAtAdd: variant.price,
      });
      setState("added");
    } catch {
      setState("error");
    }
  }

  return (
    <Button variant="add" onClick={() => void add()} disabled={state === "adding" || state === "added"} className="disabled:opacity-40">
      {state === "adding" ? "Adding" : state === "added" ? "Added" : state === "error" ? "Try again" : "Add"}
    </Button>
  );
}
