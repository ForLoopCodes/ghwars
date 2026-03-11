// Client wrapper for dither background
// Lazy loads Three.js canvas on client only

"use client";

import dynamic from "next/dynamic";

const Dither = dynamic(() => import("@/components/dither"), { ssr: false });

export default function DitherBackground() {
  return (
    <div className="absolute inset-0 -z-10">
      <Dither
        waveSpeed={0.05}
        waveFrequency={3}
        waveAmplitude={0.3}
        waveColor={[0.5, 0.5, 0.5]}
        colorNum={4}
        pixelSize={2}
      />
    </div>
  );
}
