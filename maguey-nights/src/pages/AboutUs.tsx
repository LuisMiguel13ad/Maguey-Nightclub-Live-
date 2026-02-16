import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { MapPin, Phone, Mail, Clock, UtensilsCrossed, Music } from "lucide-react";

const AboutUs = () => {
  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 bg-black">
        <div className="container mx-auto max-w-6xl text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tight"
          >
            ABOUT US
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/80 text-lg md:text-xl max-w-3xl mx-auto"
          >
            Discover the story behind Maguey Delaware - where authentic Mexican cuisine meets vibrant nightlife.
          </motion.p>
        </div>
      </section>

      {/* About Content */}
      <section className="py-20 px-4 bg-black">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-20">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-4 mb-6">
                <UtensilsCrossed className="w-12 h-12 text-[#FFD700]" />
                <h2 className="text-3xl md:text-4xl font-black text-white">RESTAURANT</h2>
              </div>
              <p className="text-white/80 text-lg leading-relaxed mb-4">
                Since 2008, Maguey Delaware has been serving authentic Mexican cuisine to the Wilmington community. 
                Our restaurant combines traditional recipes passed down through generations with fresh, locally-sourced ingredients.
              </p>
              <p className="text-white/80 text-lg leading-relaxed">
                From our famous Taco Tuesdays to our Sunday seafood specials, we're committed to bringing you 
                the authentic flavors of Mexico in a warm, family-friendly atmosphere.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-4 mb-6">
                <Music className="w-12 h-12 text-[#FFD700]" />
                <h2 className="text-3xl md:text-4xl font-black text-white">NIGHTCLUB</h2>
              </div>
              <p className="text-white/80 text-lg leading-relaxed mb-4">
                When the sun goes down, Maguey transforms into Delaware's premier Latin nightclub experience. 
                With live music, DJ sets, and a vibrant atmosphere, we bring the energy and excitement of Latin nightlife to Wilmington.
              </p>
              <p className="text-white/80 text-lg leading-relaxed">
                Whether you're celebrating a special occasion or just looking for a night out, Maguey Nightclub 
                offers an unforgettable experience with VIP tables, bottle service, and the best Latin music in Delaware.
              </p>
            </motion.div>
          </div>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-white/5 border border-white/10 rounded-lg p-8"
          >
            <h3 className="text-2xl font-bold text-white mb-6 text-center">GET IN TOUCH</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start gap-4">
                <MapPin className="w-6 h-6 text-[#FFD700] flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-white font-semibold mb-2">Location</h4>
                  <p className="text-white/80">Maguey Delaware</p>
                  <p className="text-white/80">3320 Old Capitol Trl</p>
                  <p className="text-white/80">Wilmington, DE 19808</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Phone className="w-6 h-6 text-[#FFD700] flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-white font-semibold mb-2">Phone</h4>
                  <p className="text-white/80"><a href="tel:3026602669" className="hover:text-[#FFD700] transition-colors">(302) 660-2669</a></p>
                  <p className="text-white/80 mt-2"><a href="mailto:info@elmagueydelaware.com" className="hover:text-[#FFD700] transition-colors text-sm">info@elmagueydelaware.com</a></p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Clock className="w-6 h-6 text-[#FFD700] flex-shrink-0 mt-1" />
                <div>
                  <h4 className="text-white font-semibold mb-2">Hours</h4>
                  <p className="text-white/80 text-sm">Mon: 10 AM - 10 PM</p>
                  <p className="text-white/80 text-sm">Tue: 10 AM - 2 AM</p>
                  <p className="text-white/80 text-sm">Wed: Closed</p>
                  <p className="text-white/80 text-sm">Thu: 10 AM - 10 PM</p>
                  <p className="text-white/80 text-sm">Fri-Sun: 10 AM - 2 AM</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AboutUs;

