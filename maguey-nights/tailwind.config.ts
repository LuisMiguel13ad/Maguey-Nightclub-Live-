import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const vhsEffectPlugin = plugin(({ addUtilities }) => {
  const rotateXUtilities: Record<string, any> = {};
  const rotateYUtilities: Record<string, any> = {};
  const rotateZUtilities: Record<string, any> = {};
  const rotateValues = [0, 5, 10, 15, 20, 30, 45, 75, 90];

  // Generate rotate-x utilities
  rotateValues.forEach((value) => {
    rotateXUtilities[`.rotate-x-${value}`] = {
      "--tw-rotate-x": `${value}deg`,
      transform: `
        translate3d(var(--tw-translate-x, 0), var(--tw-translate-y, 0), var(--tw-translate-z, 0))
        rotateX(var(--tw-rotate-x, 0))
        rotateY(var(--tw-rotate-y, 0))
        rotateZ(var(--tw-rotate-z, 0))
        skewX(var(--tw-skew-x, 0))
        skewY(var(--tw-skew-y, 0))
        scaleX(var(--tw-scale-x, 1))
        scaleY(var(--tw-scale-y, 1))
      `
        .replace(/\s+/g, " ")
        .trim(),
    };
    if (value !== 0) {
      rotateXUtilities[`.-rotate-x-${value}`] = {
        "--tw-rotate-x": `-${value}deg`,
        transform: `
          translate3d(var(--tw-translate-x, 0), var(--tw-translate-y, 0), var(--tw-translate-z, 0))
          rotateX(var(--tw-rotate-x, 0))
          rotateY(var(--tw-rotate-y, 0))
          rotateZ(var(--tw-rotate-z, 0))
          skewX(var(--tw-skew-x, 0))
          skewY(var(--tw-skew-y, 0))
          scaleX(var(--tw-scale-x, 1))
          scaleY(var(--tw-scale-y, 1))
        `
          .replace(/\s+/g, " ")
          .trim(),
      };
    }
  });

  // Generate rotate-y utilities
  rotateValues.forEach((value) => {
    rotateYUtilities[`.rotate-y-${value}`] = {
      "--tw-rotate-y": `${value}deg`,
      transform: `
        translate3d(var(--tw-translate-x, 0), var(--tw-translate-y, 0), var(--tw-translate-z, 0))
        rotateX(var(--tw-rotate-x, 0))
        rotateY(var(--tw-rotate-y, 0))
        rotateZ(var(--tw-rotate-z, 0))
        skewX(var(--tw-skew-x, 0))
        skewY(var(--tw-skew-y, 0))
        scaleX(var(--tw-scale-x, 1))
        scaleY(var(--tw-scale-y, 1))
      `
        .replace(/\s+/g, " ")
        .trim(),
    };
    if (value !== 0) {
      rotateYUtilities[`.-rotate-y-${value}`] = {
        "--tw-rotate-y": `-${value}deg`,
        transform: `
          translate3d(var(--tw-translate-x, 0), var(--tw-translate-y, 0), var(--tw-translate-z, 0))
          rotateX(var(--tw-rotate-x, 0))
          rotateY(var(--tw-rotate-y, 0))
          rotateZ(var(--tw-rotate-z, 0))
          skewX(var(--tw-skew-x, 0))
          skewY(var(--tw-skew-y, 0))
          scaleX(var(--tw-scale-x, 1))
          scaleY(var(--tw-scale-y, 1))
        `
          .replace(/\s+/g, " ")
          .trim(),
      };
    }
  });

  // Generate rotate-z utilities
  rotateValues.forEach((value) => {
    rotateZUtilities[`.rotate-z-${value}`] = {
      "--tw-rotate-z": `${value}deg`,
      transform: `
        translate3d(var(--tw-translate-x, 0), var(--tw-translate-y, 0), var(--tw-translate-z, 0))
        rotateX(var(--tw-rotate-x, 0))
        rotateY(var(--tw-rotate-y, 0))
        rotateZ(var(--tw-rotate-z, 0))
        skewX(var(--tw-skew-x, 0))
        skewY(var(--tw-skew-y, 0))
        scaleX(var(--tw-scale-x, 1))
        scaleY(var(--tw-scale-y, 1))
      `
        .replace(/\s+/g, " ")
        .trim(),
    };
    if (value !== 0) {
      rotateZUtilities[`.-rotate-z-${value}`] = {
        "--tw-rotate-z": `-${value}deg`,
        transform: `
          translate3d(var(--tw-translate-x, 0), var(--tw-translate-y, 0), var(--tw-translate-z, 0))
          rotateX(var(--tw-rotate-x, 0))
          rotateY(var(--tw-rotate-y, 0))
          rotateZ(var(--tw-rotate-z, 0))
          skewX(var(--tw-skew-x, 0))
          skewY(var(--tw-skew-y, 0))
          scaleX(var(--tw-scale-x, 1))
          scaleY(var(--tw-scale-y, 1))
        `
          .replace(/\s+/g, " ")
          .trim(),
      };
    }
  });

  const perspectiveUtilities = {
    ".perspective-none": { perspective: "none" },
    ".perspective-dramatic": { perspective: "100px" },
    ".perspective-near": { perspective: "300px" },
    ".perspective-normal": { perspective: "500px" },
    ".perspective-midrange": { perspective: "800px" },
    ".perspective-distant": { perspective: "1200px" },
  };

  const transformStyleUtilities = {
    ".transform-style-preserve-3d": { "transform-style": "preserve-3d" },
    ".transform-style-flat": { "transform-style": "flat" },
  };

  addUtilities({
    ...rotateXUtilities,
    ...rotateYUtilities,
    ...rotateZUtilities,
    ...perspectiveUtilities,
    ...transformStyleUtilities,
  });
});

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
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
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
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
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        montserrat: ['Montserrat', 'sans-serif'],
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "fade-in": {
          "0%": {
            opacity: "0",
            transform: "translateY(20px)"
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)"
          }
        },
        "fade-in-slow": {
          "0%": {
            opacity: "0",
            transform: "translateY(30px)"
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)"
          }
        },
        "scale-in": {
          "0%": {
            transform: "scale(0.95)",
            opacity: "0"
          },
          "100%": {
            transform: "scale(1)",
            opacity: "1"
          }
        },
        "glow-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 20px hsl(160 88% 35% / 0.4)"
          },
          "50%": {
            boxShadow: "0 0 40px hsl(160 88% 35% / 0.6)"
          }
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.6s ease-out",
        "fade-in-slow": "fade-in-slow 1s ease-out",
        "scale-in": "scale-in 0.4s ease-out",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), vhsEffectPlugin],
} satisfies Config;
