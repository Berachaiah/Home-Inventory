"use client";

import { TourStep } from "@/components/PageHeaderContext";

export default function HelpTourButton({ steps }: { steps?: TourStep[] }) {
  async function startTour() {
    if (!steps || steps.length === 0) {
      console.log("No tour on this page.");
      return;
    }
    const introJs = (await import("intro.js")).default;
    await import("intro.js/introjs.css");

    const mapped = steps.map((s) => ({
      element: s.elementId ? document.getElementById(s.elementId) ?? undefined : undefined,
      intro: s.intro,
      position: s.position ?? "bottom",
    }));

    introJs()
      .setOptions({
        steps: mapped,
        showProgress: true,
        showBullets: false,
        exitOnOverlayClick: false,
        nextLabel: "Next →",
        prevLabel: "← Back",
        doneLabel: "✅ Got it!",
        skipLabel: "Skip",
        tooltipClass: "akanbi-tour",
      })
      .start();
  }

  return (
    <button
      onClick={startTour}
      title="Take a tour of this page"
      className="focus-ring flex items-center gap-1.5 rounded-lg border border-border bg-navy/5 px-2.5 py-2 text-xs font-semibold text-navy md:px-3.5"
    >
      <span>❓</span>
      <span className="hidden md:inline">Help Tour</span>
    </button>
  );
}