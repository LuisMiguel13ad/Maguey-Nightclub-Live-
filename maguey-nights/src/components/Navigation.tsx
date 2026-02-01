import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown, Facebook, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { throttle } from "lodash-es";
import magueyLogo from "@/Pictures/maguey.jpg";
import { getPurchaseSiteBaseUrl } from "@/lib/purchaseSiteConfig";

interface MenuItem {
  label: string;
  url: string;
  dropdown?: { label: string; url: string; }[];
}

interface NavigationProps {
  transparent?: boolean;
  variant?: "default" | "restaurant";
}

const Navigation = ({ transparent = false, variant }: NavigationProps) => {
  const location = useLocation();
  // Auto-detect restaurant routes
  const isRestaurantRoute = location.pathname.startsWith("/restaurant");
  const restaurantMode = variant === "restaurant" || isRestaurantRoute;
  const [isOpen, setIsOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = throttle(() => {
      const scrollPosition = window.scrollY;
      // Change background when scrolled past 100px (adjust as needed)
      setIsScrolled(scrollPosition > 100);
    }, 100); // Update max once per 100ms

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      handleScroll.cancel(); // Cancel throttled function
    };
  }, []);

  // Different menu items for restaurant vs nightclub
  const defaultMenuItems: MenuItem[] = [
    { label: "Events", url: "/events" },
    { label: "Restaurant", url: "/restaurant" },
    { label: "Gallery", url: "/gallery" },
    { label: "Contact", url: "/contact" }
  ];

  const restaurantMenuItems: MenuItem[] = [
    { label: "Nightclub", url: "/" },
    { label: "Restaurant", url: "/restaurant" },
    { label: "About Us", url: "/about-us" }
  ];

  const menuItems = restaurantMode ? restaurantMenuItems : defaultMenuItems;

  // Determine the current styling based on scroll position and transparent prop
  const getNavStyling = () => {
    if (transparent && !isScrolled) {
      // Transparent on hero section
      return {
        navClass: 'bg-transparent',
        logoClass: 'text-2xl font-black tracking-wider text-white',
        menuClass: 'uppercase text-xs font-bold tracking-wide text-white',
        buttonClass: 'font-bold tracking-wider bg-[#339966] text-white hover:bg-[#339966]/90 border-2 border-[#339966] text-sm px-4 py-2',
        mobileButtonClass: 'text-white',
        socialClass: 'text-white hover:text-[#339966] transition-colors'
      };
    } else {
      // Black background when scrolled
      return {
        navClass: 'bg-black backdrop-blur-sm border-b border-gray-800 shadow-lg',
        logoClass: 'text-2xl font-black tracking-wider text-white',
        menuClass: 'uppercase text-xs font-bold tracking-wide text-white',
        buttonClass: 'font-bold tracking-wider bg-[#339966] text-white hover:bg-[#339966]/90 border-2 border-[#339966] text-sm px-4 py-2',
        mobileButtonClass: 'text-white',
        socialClass: 'text-white hover:text-[#339966] transition-colors'
      };
    }
  };

  const styling = getNavStyling();

  return (

    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${styling.navClass} px-6 py-4 md:px-12 md:py-6 flex items-center justify-between`}>
      {/* Logo Section */}
      <div className="flex items-center gap-2">
        {restaurantMode ? (
          <Link to="/" className="flex items-center flex-shrink-0">
            <img src={magueyLogo} alt="Maguey Logo" className="h-12 w-auto object-contain rounded-full shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
          </Link>
        ) : (
          <Link to="/" className="flex items-center flex-shrink-0 group">
            <div className="flex text-white bg-gradient-to-br from-[#39B54A] to-green-600 w-10 h-10 rounded-full shadow-[0_0_15px_rgba(57,181,74,0.4)] items-center justify-center transition-transform group-hover:scale-110">
              <img src={magueyLogo} alt="Maguey Logo" className="h-full w-full object-cover rounded-full" />
            </div>
          </Link>
        )}
      </div>

      {/* Desktop Menu - Floating Pill */}
      <div className="hidden shadow-black/20 lg:flex bg-gradient-to-br from-white/10 to-white/0 rounded-full p-1 shadow-lg backdrop-blur-md gap-1 items-center absolute left-1/2 transform -translate-x-1/2" style={{ position: 'absolute', '--border-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0))', '--border-radius-before': '9999px' } as any}>
        {menuItems.map((item) => (
          <div key={item.label} className="relative group" onMouseEnter={() => item.dropdown && setOpenDropdown(item.label)} onMouseLeave={() => setOpenDropdown(null)}>
            {item.dropdown ? (
              <>
                <button className="px-5 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors rounded-full hover:bg-white/5 flex items-center gap-1">
                  {item.label}
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>
                {openDropdown === item.label && (
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-48 bg-black/90 border border-white/10 rounded-xl shadow-xl py-2 backdrop-blur-xl overflow-hidden">
                    {item.dropdown.map((subItem) => (
                      <Link key={subItem.label} to={subItem.url} className="block px-4 py-2 text-sm text-zinc-400 hover:bg-white/10 hover:text-white transition-colors">
                        {subItem.label}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Link to={item.url} className="px-5 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors rounded-full hover:bg-white/5 inline-block">
                {item.label}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <div className="hidden sm:flex items-center gap-4">
        {/* Socials for Nightclub only */}
        {!restaurantMode && (
          <div className="hidden xl:flex items-center gap-3 mr-2">
            <a href="https://facebook.com/magueynightclub" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-[#39B54A] transition-colors"><Facebook className="w-4 h-4" /></a>
            <a href="https://instagram.com/magueynightclub" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-[#39B54A] transition-colors"><Instagram className="w-4 h-4" /></a>
          </div>
        )}

        {restaurantMode ? (
          <Link to="/restaurant/menu">
            <button className="hover:from-green-500 hover:to-green-600 hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all flex text-sm font-medium text-white bg-gradient-to-b from-green-600 to-green-700 rounded-full py-2.5 px-6 shadow-[0px_0px_0px_1px_rgba(22,163,74,1),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-sm relative" style={{ '--border-gradient': 'linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.1))', '--border-radius-before': '9999px' } as any}>
              ORDER ONLINE
            </button>
          </Link>
        ) : (
          <a href={getPurchaseSiteBaseUrl() || "http://localhost:5173/"} target="_self">
            <button className="hover:from-green-500 hover:to-green-600 hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] transition-all flex text-sm font-medium text-white bg-gradient-to-b from-green-600 to-green-700 rounded-full py-2.5 px-6 shadow-[0px_0px_0px_1px_rgba(22,163,74,1),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-sm relative items-center gap-2" style={{ '--border-gradient': 'linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.1))', '--border-radius-before': '9999px' } as any}>
              <span className="tracking-tight">BUY TICKETS</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right text-green-100"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
            </button>
          </a>
        )}
      </div>

      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden text-zinc-400 hover:text-white transition-colors"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/10 p-4 flex flex-col gap-2 shadow-2xl">
          {menuItems.map((item) => (
            <div key={item.label}>
              {item.dropdown ? (
                <>
                  <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider px-4 py-2 mt-2">{item.label}</div>
                  {item.dropdown.map(subItem => (
                    <Link key={subItem.label} to={subItem.url} onClick={() => setIsOpen(false)} className="block px-4 py-3 text-lg font-medium text-white hover:bg-white/5 rounded-xl">
                      {subItem.label}
                    </Link>
                  ))}
                </>
              ) : (
                <Link to={item.url} onClick={() => setIsOpen(false)} className="block px-4 py-3 text-lg font-medium text-white hover:bg-white/5 rounded-xl">
                  {item.label}
                </Link>
              )}
            </div>
          ))}
          <div className="mt-4 pt-4 border-t border-white/10">
            {restaurantMode ? (
              <Link to="/restaurant/menu" onClick={() => setIsOpen(false)}>
                <button className="w-full py-4 bg-[#39B54A] text-white font-bold rounded-xl uppercase tracking-wider">Order Online</button>
              </Link>
            ) : (
              <a href={getPurchaseSiteBaseUrl() || "http://localhost:5173/"} onClick={() => setIsOpen(false)}>
                <button className="w-full py-4 bg-[#39B54A] text-white font-bold rounded-xl uppercase tracking-wider">Buy Tickets</button>
              </a>
            )}
          </div>
        </div>
      )}

    </nav>
  );
};

export default Navigation;
