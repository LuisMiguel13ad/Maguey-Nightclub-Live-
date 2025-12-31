import { useEffect } from "react";

const InstagramFeed = () => {
  useEffect(() => {
    // Check if script is already loaded to prevent duplicates
    const existingScript = document.querySelector('script[src="https://elfsightcdn.com/platform.js"]');

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://elfsightcdn.com/platform.js";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
    
    // If using a single page app, sometimes the widget needs a manual re-init triggers
    // But Elfsight usually handles this with the MutationObserver in their script.
    // We'll leave the script permanent in the body to avoid reload issues.
  }, []);

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 py-12 bg-black">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-wider uppercase">
          Follow Us On Instagram
        </h2>
        <a 
          href="https://instagram.com/magueynightclub" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-white/60 hover:text-white transition-colors text-lg font-medium tracking-wide"
        >
          @magueynightclub
        </a>
      </div>
      
      {/* Elfsight Instagram Feed Widget Container */}
      <div className="elfsight-app-6a87b682-ec4a-4d1d-985c-470cd5125065" data-elfsight-app-lazy></div>
    </div>
  );
};

export default InstagramFeed;
