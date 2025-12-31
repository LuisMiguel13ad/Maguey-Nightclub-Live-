import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown, Facebook, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { throttle } from "lodash-es";
import magueyLogo from "@/Pictures/maguey.jpg";
import { getPurchaseSiteBaseUrl } from "@/lib/purchaseSiteConfig";

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
  const defaultMenuItems = [
    { label: "Events", url: "/events" },
    { label: "Restaurant", url: "/restaurant" },
    { label: "Gallery", url: "/gallery" },
    { label: "Contact", url: "/contact" }
  ];

  const restaurantMenuItems = [
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
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${styling.navClass}`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {restaurantMode ? (
            <>
              {/* Restaurant Mode: Logo Left */}
              <Link to="/" className="flex items-center flex-shrink-0">
                <img 
                  src={magueyLogo} 
                  alt="Maguey Logo" 
                  className="h-20 w-auto object-contain"
                />
              </Link>

              {/* Menu Items - Center */}
              <div className="hidden lg:flex items-center space-x-6 flex-1 justify-center">
                {menuItems.map((item) => (
                  <div
                    key={item.label}
                    className="relative group"
                    onMouseEnter={() => item.dropdown && setOpenDropdown(item.label)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    {item.dropdown ? (
                      <>
                        <button className={`flex items-center space-x-1 hover:text-primary transition-colors ${styling.menuClass}`}>
                          <span>{item.label}</span>
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        {openDropdown === item.label && (
                          <div className="absolute top-full left-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded shadow-lg py-2">
                            {item.dropdown.map((subItem) => (
                              <Link
                                key={subItem.label}
                                to={subItem.url}
                                className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                              >
                                {subItem.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <Link
                        to={item.url}
                        className={`hover:text-primary transition-colors ${styling.menuClass}`}
                      >
                        {item.label}
                      </Link>
                    )}
                  </div>
                ))}
              </div>

              {/* ORDER ONLINE Button - Right */}
              <div className="hidden lg:flex items-center flex-shrink-0">
                <Link to="/restaurant/menu">
                  <Button variant="default" size="sm" className={styling.buttonClass}>
                    ORDER ONLINE
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              {/* Default Mode: Social Media Links - Left Side */}
              <div className="hidden lg:flex items-center space-x-4">
                <a href="https://facebook.com/magueynightclub" target="_blank" rel="noopener noreferrer" className={styling.socialClass}>
                  <Facebook className="w-5 h-5" />
                </a>
                <a href="https://instagram.com/magueynightclub" target="_blank" rel="noopener noreferrer" className={styling.socialClass}>
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="https://tiktok.com/@magueynightclub" target="_blank" rel="noopener noreferrer" className={styling.socialClass}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
                </a>
              </div>

              {/* Logo - Center */}
              <Link to="/" className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
                <img 
                  src={magueyLogo} 
                  alt="Maguey Logo" 
                  className="h-20 w-auto object-contain"
                />
              </Link>

              {/* Desktop Menu - Right Side */}
              <div className="hidden lg:flex items-center space-x-6">
                {menuItems.map((item) => (
                  <div
                    key={item.label}
                    className="relative group"
                    onMouseEnter={() => item.dropdown && setOpenDropdown(item.label)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    {item.dropdown ? (
                      <>
                        <button className={`flex items-center space-x-1 hover:text-primary transition-colors ${styling.menuClass}`}>
                          <span>{item.label}</span>
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        {openDropdown === item.label && (
                          <div className="absolute top-full left-0 mt-2 w-48 bg-gray-900 border border-gray-700 rounded shadow-lg py-2">
                            {item.dropdown.map((subItem) => (
                              <Link
                                key={subItem.label}
                                to={subItem.url}
                                className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                              >
                                {subItem.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <Link
                        to={item.url}
                        className={`hover:text-primary transition-colors ${styling.menuClass}`}
                      >
                        {item.label}
                      </Link>
                    )}
                  </div>
                ))}
                <a href={getPurchaseSiteBaseUrl() || "http://localhost:5173/"} target="_self">
                  <Button variant="default" size="sm" className={styling.buttonClass}>
                    BUY TICKETS
                  </Button>
                </a>
              </div>
            </>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`lg:hidden ${styling.mobileButtonClass}`}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className={`lg:hidden py-4 border-t ${isScrolled ? 'border-gray-700' : 'border-white/20'}`}>
            {/* Mobile Social Media Links */}
            <div className="flex items-center justify-center space-x-6 px-4 py-3 border-b border-gray-700 mb-4">
              <a href="https://facebook.com/magueynightclub" target="_blank" rel="noopener noreferrer" className={styling.socialClass}>
                <Facebook className="w-5 h-5" />
              </a>
              <a href="https://instagram.com/magueynightclub" target="_blank" rel="noopener noreferrer" className={styling.socialClass}>
                <Instagram className="w-5 h-5" />
              </a>
              <a href="https://tiktok.com/@magueynightclub" target="_blank" rel="noopener noreferrer" className={styling.socialClass}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </a>
            </div>
            {menuItems.map((item) => (
              <div key={item.label}>
                {item.dropdown ? (
                  <div>
                    <button
                      onClick={() => setOpenDropdown(openDropdown === item.label ? null : item.label)}
                      className={`flex items-center justify-between w-full px-4 py-3 hover:text-primary ${styling.menuClass}`}
                    >
                      <span>{item.label}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${openDropdown === item.label ? 'rotate-180' : ''}`} />
                    </button>
                    {openDropdown === item.label && (
                      <div className="pl-8">
                        {item.dropdown.map((subItem) => (
                          <Link
                            key={subItem.label}
                            to={subItem.url}
                            className={`block px-4 py-2 text-sm ${isScrolled ? 'text-gray-300' : 'text-white/80'} hover:text-primary`}
                            onClick={() => setIsOpen(false)}
                          >
                            {subItem.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    to={item.url}
                    className={`block px-4 py-3 hover:text-primary ${styling.menuClass}`}
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
            <div className="px-4 pt-4">
              {restaurantMode ? (
                <Link to="/restaurant/menu" onClick={() => setIsOpen(false)}>
                  <Button className={styling.buttonClass + " w-full"}>
                    ORDER ONLINE
                  </Button>
                </Link>
              ) : (
                <a href={getPurchaseSiteBaseUrl() || "http://localhost:5173/"} target="_self" onClick={() => setIsOpen(false)}>
                  <Button className={styling.buttonClass + " w-full"}>
                    BUY TICKETS
                  </Button>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
