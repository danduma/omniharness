"use client";

import React, { useState, useEffect } from "react";
import { Fx, FxStagger, FxWords } from "../fx/Fx";

export default function FxSpikePage() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setActive(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="p-20 space-y-12 bg-slate-950 min-h-screen text-white">
      <h1 className="text-3xl font-bold">Fx Framework Spike</h1>
      
      <section 
        data-walkthrough-scene 
        data-active={active ? "true" : undefined}
        className="border border-white/10 p-8 rounded-xl space-y-8"
      >
        <div className="space-y-2">
          <h2 className="text-sm uppercase tracking-widest text-slate-500">0.2 Play Proof</h2>
          <Fx effect="fxFadeUp" at="0s" className="text-xl">
            This should fade up immediately when active.
          </Fx>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm uppercase tracking-widest text-slate-500">0.3 Helper Proof</h2>
          <Fx effect="fxPopIn" at="0.5s" className="bg-indigo-600 p-4 rounded-lg inline-block">
            This pops in after 0.5s.
          </Fx>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm uppercase tracking-widest text-slate-500">0.4 Stagger Proof</h2>
          <FxStagger as="ul" at="1s" stagger="0.2s" effect="fxFadeRight" className="space-y-2 list-disc list-inside">
            <li>First staggered item</li>
            <li>Second staggered item</li>
            <li>Third staggered item</li>
          </FxStagger>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm uppercase tracking-widest text-slate-500">0.4 Words Proof</h2>
          <p className="text-2xl leading-relaxed">
            <FxWords 
              text="This is the words reveal effect proof of concept." 
              at="2s" 
              duration="1s" 
            />
          </p>
        </div>
      </section>

      <button 
        onClick={() => {
          setActive(false);
          setTimeout(() => setActive(true), 100);
        }}
        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded transition-colors"
      >
        Restart Animations
      </button>
    </div>
  );
}
