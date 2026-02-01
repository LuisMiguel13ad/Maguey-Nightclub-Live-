import { useState } from "react";
import { Instagram, Facebook, Music } from "lucide-react";
import { useNewsletter } from "@/hooks/useNewsletter";

const Footer = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const { subscribe, isLoading, success, reset } = useNewsletter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    const result = await subscribe(email, 'footer');
    setMessage(result.message);

    if (result.success) {
      setEmail("");
      setTimeout(() => {
        setMessage(null);
        reset();
      }, 5000);
    }
  };

  return (
    <footer className="bg-transparent backdrop-blur-sm border-t border-white/5 relative z-10">
      <div className="container mx-auto px-4 py-12">
        {/* Newsletter Section */}
        <div className="mb-12 pb-8 border-b border-white/10">
          <div className="max-w-2xl mx-auto text-center">
            <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
              Stay in the Loop
            </h3>
            <p className="text-white/60 text-sm mb-6">
              Get exclusive access to events, VIP deals, and special announcements.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:border-[#39B54A]/50 transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="px-6 py-3 bg-[#39B54A] text-black text-sm font-bold tracking-wider uppercase rounded-lg hover:bg-[#2d9a3c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isLoading ? "..." : "Subscribe"}
              </button>
            </form>
            {message && (
              <p className={`mt-3 text-sm ${success ? 'text-[#39B54A]' : 'text-red-400'}`}>
                {message}
              </p>
            )}
            <p className="text-white/40 text-xs mt-3">
              No spam, just vibes. Unsubscribe anytime.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="text-2xl font-bold text-[#39B54A] mb-4 tracking-wider">
              MAGUEY
            </h3>
            <p className="text-white/60 text-sm">
              Delaware's premier Latin-inspired nightclub experience.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-bold mb-4 tracking-wide uppercase text-sm">
              Contact
            </h4>
            <div className="space-y-2 text-white/60 text-sm">
              <p>3320 Old Capitol Trl</p>
              <p>Wilmington, DE 19808</p>
              <p><a href="mailto:info@elmagueydelaware.com" className="hover:text-[#39B54A] transition-colors">info@elmagueydelaware.com</a></p>
              <p><a href="tel:3026602669" className="hover:text-[#39B54A] transition-colors">(302) 660-2669</a></p>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-bold mb-4 tracking-wide uppercase text-sm">
              Quick Links
            </h4>
            <div className="space-y-2">
              <a href="/events" className="block text-white/60 hover:text-[#39B54A] transition-colors text-sm">
                Events
              </a>
              <a href="/gallery" className="block text-white/60 hover:text-[#39B54A] transition-colors text-sm">
                Gallery
              </a>
            </div>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-bold mb-4 tracking-wide uppercase text-sm">
              Resources
            </h4>
            <div className="space-y-2">
              <a href="/careers" className="block text-white/60 hover:text-[#39B54A] transition-colors text-sm">
                Careers
              </a>
              <a href="/faq" className="block text-white/60 hover:text-[#39B54A] transition-colors text-sm">
                FAQ
              </a>
              <a href="/policies" className="block text-white/60 hover:text-[#39B54A] transition-colors text-sm">
                Policies
              </a>
            </div>
          </div>
        </div>

        {/* Social & Copyright */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/60 text-sm">
            © 2025 Maguey Nightclub. All rights reserved.
          </p>

          <div className="flex gap-6">
            <a
              href="https://instagram.com/magueynightclub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-[#39B54A] transition-colors"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a
              href="https://facebook.com/magueynightclub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-[#39B54A] transition-colors"
            >
              <Facebook className="w-5 h-5" />
            </a>
            <a
              href="https://tiktok.com/@magueynightclub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-[#39B54A] transition-colors"
            >
              <Music className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
