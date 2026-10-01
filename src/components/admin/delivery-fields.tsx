"use client";

import { useState } from "react";
import { input, label } from "./ui";

/** Own delivery vs courier. Courier shows company + tracking number; own delivery shows rider info. */
export function DeliveryFields(props: {
  couriers: readonly string[];
  defaults?: { method?: "OWN" | "COURIER" | null; courier?: string | null; trackingNumber?: string | null; riderInfo?: string | null };
}) {
  const d = props.defaults ?? {};
  const [method, setMethod] = useState<"OWN" | "COURIER">(d.method ?? "OWN");
  return (
    <div className="space-y-3">
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className={`${label} mb-1`}>Delivered by</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="method" value="OWN" checked={method === "OWN"} onChange={() => setMethod("OWN")} /> Our own delivery
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="method" value="COURIER" checked={method === "COURIER"} onChange={() => setMethod("COURIER")} /> Courier company
        </label>
      </fieldset>

      {method === "COURIER" ? (
        <div className="flex flex-wrap gap-3">
          <label className="block space-y-1">
            <span className={label}>Courier</span>
            <select name="courier" defaultValue={d.courier ?? ""} required className={`${input} w-auto`}>
              <option value="" disabled>
                Choose…
              </option>
              {props.couriers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className={label}>Tracking no. (optional)</span>
            <input name="trackingNumber" defaultValue={d.trackingNumber ?? ""} placeholder="From the courier's receipt" className={`${input} w-56`} />
          </label>
        </div>
      ) : (
        <label className="block space-y-1">
          <span className={label}>Rider name / phone (optional)</span>
          <input name="riderInfo" defaultValue={d.riderInfo ?? ""} className={`${input} w-64`} />
        </label>
      )}
    </div>
  );
}
