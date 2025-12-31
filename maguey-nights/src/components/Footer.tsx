import { Instagram, Facebook, Music } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="text-2xl font-bold text-primary mb-4 tracking-wider">
              MAGUEY
            </h3>
            <p className="text-muted-foreground text-sm">
              Delaware's premier Latin-inspired nightclub experience.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-foreground font-bold mb-4 tracking-wide uppercase text-sm">
              Contact
            </h4>
            <div className="space-y-2 text-muted-foreground text-sm">
              <p>3320 Old Capitol Trl</p>
              <p>Wilmington, DE 19808</p>
              <p><a href="mailto:info@elmagueydelaware.com" className="hover:text-primary transition-colors">info@elmagueydelaware.com</a></p>
              <p><a href="tel:3026602669" className="hover:text-primary transition-colors">(302) 660-2669</a></p>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-foreground font-bold mb-4 tracking-wide uppercase text-sm">
              Quick Links
            </h4>
            <div className="space-y-2">
              <a href="/events" className="block text-muted-foreground hover:text-primary transition-colors text-sm">
                Events
              </a>
              <a href="/gallery" className="block text-muted-foreground hover:text-primary transition-colors text-sm">
                Gallery
              </a>
            </div>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-foreground font-bold mb-4 tracking-wide uppercase text-sm">
              Resources
            </h4>
            <div className="space-y-2">
              <a href="/careers" className="block text-muted-foreground hover:text-primary transition-colors text-sm">
                Careers
              </a>
              <a href="/faq" className="block text-muted-foreground hover:text-primary transition-colors text-sm">
                FAQ
              </a>
              <a href="/policies" className="block text-muted-foreground hover:text-primary transition-colors text-sm">
                Policies
              </a>
            </div>
          </div>
        </div>

        {/* Social & Copyright */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm">
            © 2025 Maguey Nightclub. All rights reserved.
          </p>
          
          <div className="flex gap-6">
            <a 
              href="https://instagram.com/magueynightclub" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <a 
              href="https://facebook.com/magueynightclub" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              <Facebook className="w-5 h-5" />
            </a>
            <a 
              href="https://tiktok.com/@magueynightclub" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
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
