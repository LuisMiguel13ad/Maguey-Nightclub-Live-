import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import InstagramFeed from "@/components/InstagramFeed";
import { motion } from "framer-motion";

const Gallery = () => {
  return (
    <div className="min-h-screen bg-black">
      {/* Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Navigation />
      </div>

      {/* Hero Section */}
      <section className="pt-40 pb-24 px-4 bg-black">
        <div className="container mx-auto max-w-7xl text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-5xl md:text-7xl font-black text-white mb-6 tracking-wider drop-shadow-[0_0_30px_rgba(255,0,180,0.25)]"
          >
            GALLERY
          </motion.h1>
        </div>
      </section>

      {/* Instagram Feed Section */}
      <section className="py-12 bg-black border-t border-white/10">
        <InstagramFeed />
      </section>

      <Footer />
    </div>
  );
};

export default Gallery;

