"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";

type HeroButton = { text: string; link: string };

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function reducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function HomeHero({
  imageUrl,
  mobileImageUrl,
  heading,
  subheading,
  button,
  videoUrl,
}: {
  imageUrl: string;
  mobileImageUrl: string;
  heading: string | null;
  subheading: string | null;
  button: HeroButton | null;
  /** Unused until the homepage banner can store a video. */
  videoUrl?: string | null;
}) {
  const reduceMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => false);
  const playVideo = Boolean(videoUrl) && !reduceMotion;
  const decorative = Boolean(heading);

  return (
    <section className="relative min-h-[70vh] bg-[#f4f4f4] sm:min-h-[85vh]">
      {playVideo ? (
        <video className="absolute inset-0 h-full w-full object-cover" muted loop playsInline autoPlay poster={imageUrl}>
          <source src={videoUrl!} />
        </video>
      ) : (
        <>
          <Image src={mobileImageUrl} alt={decorative ? "" : "Aurelé"} fill priority sizes="100vw" className="object-cover sm:hidden" />
          <Image src={imageUrl} alt={decorative ? "" : "Aurelé"} fill priority sizes="100vw" className="hidden object-cover sm:block" />
        </>
      )}
      {(heading || subheading || button) && (
        <div className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-6 py-16 text-center sm:min-h-[85vh]">
          <div className="flex max-w-3xl flex-col items-center gap-4 bg-white/80 px-8 py-10">
            {heading && <h1 className="font-display text-4xl font-normal tracking-[0.04em] uppercase sm:text-6xl">{heading}</h1>}
            {subheading && <p className="max-w-md text-sm tracking-[0.14em] uppercase">{subheading}</p>}
            {button && (
              <Link href={button.link} className="btn btn-add mt-2">
                {button.text}
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
