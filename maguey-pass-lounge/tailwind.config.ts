import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // ═══════════════════════════════════════════════════════════════
      // TYPOGRAPHY SYSTEM - Premium Editorial + Modern Sans
      // ═══════════════════════════════════════════════════════════════
      fontFamily: {
        // Display Serif - Large headlines, hero text
        // Paid: Freight Display Pro | Free: Playfair Display
        'display': ['"Playfair Display"', 'Georgia', 'Times New Roman', 'serif'],
        
        // Accent Serif Italic - Emphasis words in headlines
        'accent': ['"Playfair Display"', 'Georgia', 'serif'],
        
        // UI Sans - Body text, UI elements, buttons
        // Paid: Söhne, Graphik | Free: Inter, DM Sans
        'sans': ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        
        // Condensed Display - Event titles, nightclub headers, impact text
        // Paid: Tungsten, Knockout | Free: Bebas Neue, Oswald
        'condensed': ['"Bebas Neue"', '"Oswald"', 'Impact', 'sans-serif'],
        
        // Mono - Labels, codes, technical
        'mono': ['"Space Mono"', 'Consolas', 'monospace'],
        
        // Legacy support
        'serif': ['"Playfair Display"', 'Georgia', 'serif'],
      },
      
      // Font sizes with responsive line heights
      fontSize: {
        // Display sizes (for headlines)
        'display-2xl': ['clamp(3.5rem, 8vw, 7rem)', { lineHeight: '0.95', letterSpacing: '-0.02em', fontWeight: '400' }],
        'display-xl': ['clamp(2.75rem, 6vw, 5rem)', { lineHeight: '0.95', letterSpacing: '-0.02em', fontWeight: '400' }],
        'display-lg': ['clamp(2rem, 4vw, 3.5rem)', { lineHeight: '1', letterSpacing: '-0.01em', fontWeight: '400' }],
        'display-md': ['clamp(1.5rem, 3vw, 2.5rem)', { lineHeight: '1.1', letterSpacing: '-0.01em', fontWeight: '400' }],
        'display-sm': ['clamp(1.25rem, 2vw, 1.75rem)', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '500' }],
        
        // Condensed sizes (for event titles, impact headers)
        'condensed-2xl': ['clamp(4rem, 10vw, 9rem)', { lineHeight: '0.85', letterSpacing: '0.02em', fontWeight: '400' }],
        'condensed-xl': ['clamp(3rem, 7vw, 6rem)', { lineHeight: '0.9', letterSpacing: '0.02em', fontWeight: '400' }],
        'condensed-lg': ['clamp(2rem, 5vw, 4rem)', { lineHeight: '0.9', letterSpacing: '0.02em', fontWeight: '400' }],
        
        // Body sizes
        'body-lg': ['1.125rem', { lineHeight: '1.7', letterSpacing: '0' }],
        'body': ['1rem', { lineHeight: '1.7', letterSpacing: '0' }],
        'body-sm': ['0.875rem', { lineHeight: '1.6', letterSpacing: '0' }],
        
        // UI sizes
        'ui': ['0.875rem', { lineHeight: '1.4', letterSpacing: '0.01em', fontWeight: '500' }],
        'ui-sm': ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.01em', fontWeight: '500' }],
        
        // Labels & Eyebrows (uppercase, spaced)
        'eyebrow': ['0.75rem', { lineHeight: '1.2', letterSpacing: '0.15em', fontWeight: '500' }],
        'eyebrow-sm': ['0.625rem', { lineHeight: '1.2', letterSpacing: '0.2em', fontWeight: '500' }],
        
        // Captions & Stats
        'caption': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.02em' }],
        'stat': ['clamp(2.5rem, 5vw, 4rem)', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '600' }],
      },
      
      // Letter spacing tokens
      letterSpacing: {
        'tightest': '-0.04em',
        'tighter': '-0.02em',
        'tight': '-0.01em',
        'normal': '0',
        'wide': '0.02em',
        'wider': '0.05em',
        'widest': '0.1em',
        'eyebrow': '0.15em',
        'label': '0.2em',
      },
      
      // Max widths for readability
      maxWidth: {
        'prose-sm': '55ch',
        'prose': '65ch',
        'prose-lg': '75ch',
        'headline': '20ch',
        'headline-lg': '25ch',
      },
      
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        vip: {
          DEFAULT: "hsl(var(--vip))",
          foreground: "hsl(var(--vip-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Forest/Teal Theme
        forest: {
          950: '#050a08',
          900: '#0f1c16',
          800: '#162921',
          700: '#1d3a2e',
        },
        copper: {
          400: '#5eead4',
          500: '#2dd4bf',
          600: '#14b8a6',
          900: '#134e4a',
        },
        bronze: {
          400: '#d4a373',
          500: '#b08968',
        },
        stone: {
          850: '#1c1917',
        },
        // Neon accent colors for nightclub vibe
        neon: {
          green: '#39FF14',
          cyan: '#00FFFF',
          pink: '#FF10F0',
          gold: '#FFD700',
        },
        darkbg: "#050a09",
        deepteal: "#0a1a18",
        sage: "#9ca3af",
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-secondary": "var(--gradient-secondary)",
        "gradient-vip": "var(--gradient-vip)",
        "gradient-dark": "var(--gradient-dark)",
        'noise': "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.8\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\"/%3E%3C/svg%3E')",
      },
      boxShadow: {
        "glow-primary": "var(--glow-primary)",
        "glow-secondary": "var(--glow-secondary)",
        "glow-vip": "var(--glow-vip)",
        "elevated": "var(--shadow-elevated)",
        "glow-copper": "0 0 40px rgba(94, 234, 212, 0.3)",
        "glow-bronze": "0 0 40px rgba(212, 163, 115, 0.3)",
        "glow-neon": "0 0 30px rgba(57, 255, 20, 0.5)",
        "text-glow": "0 0 40px currentColor",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "glow-pulse": {
          "0%, 100%": { filter: "drop-shadow(0 0 20px currentColor)" },
          "50%": { filter: "drop-shadow(0 0 40px currentColor)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slow-pan": {
          "0%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1.2)" },
        },
        "fade-content": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "reveal": {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "text-shimmer": {
          "0%": { backgroundPosition: "200% center" },
          "100%": { backgroundPosition: "-200% center" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "slide-up": "slide-up 0.5s ease-out",
        "slow-pan": "slow-pan 20s infinite alternate ease-in-out",
        "fade-up": "fade-content 1s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-in-left": "slide-in-left 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "reveal": "reveal 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "text-shimmer": "text-shimmer 3s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
