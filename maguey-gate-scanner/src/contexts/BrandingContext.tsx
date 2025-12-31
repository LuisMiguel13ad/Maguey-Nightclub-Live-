import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getCurrentVenueBranding, type VenueBranding, type BrandingConfig } from '@/lib/branding-service';

interface BrandingContextType {
  branding: VenueBranding | null;
  loading: boolean;
  refreshBranding: () => Promise<void>;
  applyBranding: (config: BrandingConfig) => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};

interface BrandingProviderProps {
  children: ReactNode;
}

/**
 * Convert hex color to HSL
 */
const hexToHsl = (hex: string): string => {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

/**
 * Apply branding configuration to CSS variables
 */
const applyBrandingToCSS = (config: BrandingConfig) => {
  const root = document.documentElement;

  // Apply colors
  if (config.primary_color) {
    const primaryHsl = hexToHsl(config.primary_color);
    root.style.setProperty('--primary', primaryHsl);
    root.style.setProperty('--ring', primaryHsl);
  }

  if (config.secondary_color) {
    const secondaryHsl = hexToHsl(config.secondary_color);
    root.style.setProperty('--secondary', secondaryHsl);
  }

  if (config.accent_color) {
    const accentHsl = hexToHsl(config.accent_color);
    root.style.setProperty('--accent', accentHsl);
    root.style.setProperty('--success', accentHsl);
  }

  // Apply font family
  if (config.font_family) {
    root.style.setProperty('--font-family', config.font_family);
    document.body.style.fontFamily = config.font_family;
  }

  // Apply custom CSS
  if (config.custom_css) {
    let styleElement = document.getElementById('custom-branding-css');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'custom-branding-css';
      document.head.appendChild(styleElement);
    }
    styleElement.textContent = config.custom_css;
  } else {
    // Remove custom CSS if not present
    const styleElement = document.getElementById('custom-branding-css');
    if (styleElement) {
      styleElement.remove();
    }
  }

  // Apply favicon
  if (config.favicon_url) {
    let favicon = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.href = config.favicon_url;
  }
};

export const BrandingProvider = ({ children }: BrandingProviderProps) => {
  const [branding, setBranding] = useState<VenueBranding | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshBranding = async () => {
    try {
      setLoading(true);
      const currentBranding = await getCurrentVenueBranding();
      setBranding(currentBranding);
      
      if (currentBranding) {
        applyBrandingToCSS({
          primary_color: currentBranding.primary_color,
          secondary_color: currentBranding.secondary_color,
          accent_color: currentBranding.accent_color,
          font_family: currentBranding.font_family,
          custom_css: currentBranding.custom_css || undefined,
          favicon_url: currentBranding.favicon_url || undefined,
        });
      }
    } catch (error) {
      console.error('Error refreshing branding:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyBranding = (config: BrandingConfig) => {
    applyBrandingToCSS(config);
  };

  useEffect(() => {
    refreshBranding();
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, loading, refreshBranding, applyBranding }}>
      {children}
    </BrandingContext.Provider>
  );
};

