import { cardo, petrona } from "@/lib/fonts";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${cardo.variable} ${petrona.variable} ${cardo.className} admin min-h-full text-[#1c1c1c]`}>
      {children}
    </div>
  );
}
