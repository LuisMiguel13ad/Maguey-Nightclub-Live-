/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPOGRAPHY SHOWCASE - Maguey Nightclub
 * 
 * This component demonstrates the premium editorial typography system.
 * Use this as a reference for implementing consistent typography.
 * 
 * DELETE THIS FILE after reviewing - it's for reference only.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';

export default function TypographyShowcase() {
  return (
    <div className="min-h-screen bg-forest-950 p-8 md:p-16 space-y-20">
      {/* Header */}
      <header className="border-b border-white/10 pb-8">
        <p className="eyebrow text-copper-400 mb-4">Design System</p>
        <h1 className="h1 text-white">Typography System</h1>
        <p className="body text-stone-400 mt-6">
          Premium editorial serif + modern sans typography for Maguey Nightclub.
        </p>
      </header>

      {/* ═══════════════════════════════════════════════════════════════
          HERO HEADLINE EXAMPLES
          ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-12">
        <div>
          <p className="eyebrow-sm text-copper-400 mb-6">Hero Headlines</p>
          
          {/* Example 1: With Italic Emphasis */}
          <div className="mb-16 p-8 bg-forest-900/50 rounded-lg border border-white/5">
            <p className="label text-stone-500 mb-4">With Italic Emphasis Word</p>
            <h1 className="h1 text-white">
              Where Every Night Becomes{' '}
              <span className="accent-italic text-copper-400">Legendary</span>
            </h1>
          </div>

          {/* Example 2: Without Italic */}
          <div className="mb-16 p-8 bg-forest-900/50 rounded-lg border border-white/5">
            <p className="label text-stone-500 mb-4">Without Italic (Pure Serif)</p>
            <h1 className="h1 text-white">
              The Premier Latin Nightlife Experience
            </h1>
          </div>

          {/* Example 3: Condensed for Events */}
          <div className="mb-16 p-8 bg-forest-900/50 rounded-lg border border-white/5">
            <p className="label text-stone-500 mb-4">Condensed (Event Titles)</p>
            <p className="eyebrow text-copper-400 mb-2">December 21, 2024</p>
            <h2 className="headline-condensed text-white">
              New Year's Eve Gala
            </h2>
          </div>

          {/* Example 4: Mixed Headline */}
          <div className="p-8 bg-forest-900/50 rounded-lg border border-white/5">
            <p className="label text-stone-500 mb-4">Mixed: Condensed + Serif Accent</p>
            <p className="eyebrow text-stone-500 mb-2">This Saturday</p>
            <h2 className="headline-condensed-lg text-white mb-2">
              Reggaeton Nights
            </h2>
            <p className="h5 text-stone-400">
              Featuring <span className="accent-italic text-copper-400">DJ Fuego</span>
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          TYPOGRAPHY SCALE
          ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-8">
        <p className="eyebrow-sm text-copper-400 mb-2">Typography Scale</p>
        
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <span className="label text-stone-600">.h1 / Display Serif</span>
            <span className="h1 text-white">The Night Awaits</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="label text-stone-600">.h2 / Display Serif</span>
            <span className="h2 text-white">VIP Experience</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="label text-stone-600">.h3 / Display Serif</span>
            <span className="h3 text-white">Bottle Service</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="label text-stone-600">.headline-condensed / Bebas Neue</span>
            <span className="headline-condensed text-white">Saturday Night</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="label text-stone-600">.eyebrow / Sans Uppercase</span>
            <span className="eyebrow text-copper-400">Upcoming Events</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="label text-stone-600">.body / Sans Serif</span>
            <p className="body text-stone-300">
              Experience Wilmington's premier Latin nightlife destination. 
              From reggaeton to cumbia, every weekend brings unforgettable vibes.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="label text-stone-600">.caption / Small Sans</span>
            <span className="caption">Doors open at 10PM • 21+ with valid ID</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SPECIAL EFFECTS
          ═══════════════════════════════════════════════════════════════ */}
      <section className="space-y-8">
        <p className="eyebrow-sm text-copper-400 mb-2">Special Effects</p>
        
        <div className="space-y-8">
          <div className="p-6 bg-forest-900/50 rounded-lg">
            <span className="label text-stone-600 block mb-4">.text-glow</span>
            <span className="h2 text-copper-400 text-glow">VIP Access</span>
          </div>

          <div className="p-6 bg-forest-900/50 rounded-lg">
            <span className="label text-stone-600 block mb-4">.text-gradient</span>
            <span className="h2 text-gradient">Premium Experience</span>
          </div>

          <div className="p-6 bg-forest-900/50 rounded-lg">
            <span className="label text-stone-600 block mb-4">.text-shimmer</span>
            <span className="h2 text-shimmer">Exclusive Offer</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          STATS DISPLAY
          ═══════════════════════════════════════════════════════════════ */}
      <section>
        <p className="eyebrow-sm text-copper-400 mb-6">Stats Display</p>
        
        <div className="grid grid-cols-3 gap-8">
          <div className="text-center">
            <span className="stat text-copper-400">500+</span>
            <span className="stat-label block mt-2">Weekly Guests</span>
          </div>
          <div className="text-center">
            <span className="stat text-copper-400">12</span>
            <span className="stat-label block mt-2">VIP Tables</span>
          </div>
          <div className="text-center">
            <span className="stat text-copper-400">3</span>
            <span className="stat-label block mt-2">Dance Floors</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          USAGE GUIDELINES
          ═══════════════════════════════════════════════════════════════ */}
      <section className="border-t border-white/10 pt-12">
        <p className="eyebrow-sm text-copper-400 mb-6">Usage Guidelines</p>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h4 className="h5 text-white">When to Use Serif (.h1, .h2)</h4>
            <ul className="body-sm text-stone-400 space-y-2">
              <li>• Hero headlines</li>
              <li>• Marketing copy</li>
              <li>• Section titles</li>
              <li>• Elegant, premium feeling</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="h5 text-white">When to Use Condensed</h4>
            <ul className="body-sm text-stone-400 space-y-2">
              <li>• Event titles & dates</li>
              <li>• Nightclub headers</li>
              <li>• Impact text (SOLD OUT, VIP)</li>
              <li>• High-energy moments</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="h5 text-white">Neon Text Tips</h4>
            <ul className="body-sm text-stone-400 space-y-2">
              <li>• Use .text-glow sparingly</li>
              <li>• Never use neon on neon</li>
              <li>• Add dark text-shadow for readability</li>
              <li>• Prefer copper-400 over pure white</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="h5 text-white">Italic Accent Rules</h4>
            <ul className="body-sm text-stone-400 space-y-2">
              <li>• Use for 1-3 words max</li>
              <li>• Emphasize action/emotion words</li>
              <li>• Pair with a different color</li>
              <li>• Example: "...becomes <em>Legendary</em>"</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Font Family Reference */}
      <section className="border-t border-white/10 pt-12 pb-20">
        <p className="eyebrow-sm text-copper-400 mb-6">Font Families</p>
        
        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-6 bg-forest-900/30 rounded-lg">
            <p className="label text-stone-600 mb-2">Display Serif</p>
            <p className="font-display text-2xl text-white mb-2">Playfair Display</p>
            <p className="caption">Paid alt: Freight Display Pro, Canela</p>
          </div>

          <div className="p-6 bg-forest-900/30 rounded-lg">
            <p className="label text-stone-600 mb-2">UI Sans</p>
            <p className="font-sans text-2xl text-white mb-2">Inter</p>
            <p className="caption">Paid alt: Söhne, Graphik</p>
          </div>

          <div className="p-6 bg-forest-900/30 rounded-lg">
            <p className="label text-stone-600 mb-2">Condensed Display</p>
            <p className="font-condensed text-2xl text-white mb-2 uppercase">Bebas Neue</p>
            <p className="caption">Paid alt: Tungsten, Knockout</p>
          </div>

          <div className="p-6 bg-forest-900/30 rounded-lg">
            <p className="label text-stone-600 mb-2">Mono</p>
            <p className="font-mono text-2xl text-white mb-2">Space Mono</p>
            <p className="caption">For labels, codes, technical text</p>
          </div>
        </div>
      </section>
    </div>
  );
}

