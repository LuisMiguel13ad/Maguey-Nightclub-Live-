import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

// Import venue and event images
import venueMainstage from "@/Pictures/venue-mainstage.jpg";
import venueVip from "@/Pictures/venue-vip.jpg";
import venuePatio from "@/Pictures/venue-patio.jpg";
import eventChampagne from "@/Pictures/event-champagne.jpg";
import eventReggaeton from "@/Pictures/event-reggaeton.jpg";
import eventFiesta from "@/Pictures/event-fiesta.jpg";
import social1 from "@/Pictures/social-1.jpg";
import social2 from "@/Pictures/social-2.jpg";
import social3 from "@/Pictures/social-3.jpg";

const Gallery = () => {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  // All gallery images - uniform grid
  const galleryImages = [
    { src: venueVip, alt: "VIP Lounge" },
    { src: venueMainstage, alt: "Main Stage" },
    { src: venuePatio, alt: "Patio Area" },
    { src: eventChampagne, alt: "Champagne Night" },
    { src: eventReggaeton, alt: "Reggaeton Friday" },
    { src: eventFiesta, alt: "Fiesta Night" },
    { src: social1, alt: "Nightlife Moments" },
    { src: social2, alt: "VIP Experience" },
    { src: social3, alt: "Dance Floor" },
  ];

  const handlePrevious = () => {
    if (selectedImage !== null) {
      setSelectedImage(selectedImage === 0 ? galleryImages.length - 1 : selectedImage - 1);
    }
  };

  const handleNext = () => {
    if (selectedImage !== null) {
      setSelectedImage(selectedImage === galleryImages.length - 1 ? 0 : selectedImage + 1);
    }
  };

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImage === null) return;
      if (e.key === "ArrowLeft") handlePrevious();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") setSelectedImage(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImage]);

  return (
    <div className="min-h-screen bg-black">
      {/* Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Navigation />
      </div>

      {/* Hero Section - Full Bleed with Overlay */}
      <section className="relative h-[60vh] md:h-[70vh] w-full overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ 
            backgroundImage: `url(${eventChampagne})`,
          }}
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black" />
        
        {/* Content */}
        <div className="relative h-full flex flex-col items-center justify-center text-center px-4">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold text-white tracking-[0.2em] mb-4 uppercase"
            style={{ 
              textShadow: "0 4px 30px rgba(0,0,0,0.5)"
            }}
          >
            GALLERY
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
            className="text-lg md:text-xl text-white/90 tracking-widest uppercase font-light"
          >
            Experience Maguey Nightclub
          </motion.p>
        </div>
      </section>

      {/* Title Section - Right Below Hero */}
      <section className="py-16 md:py-20 px-4 bg-black">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-[0.2em] mb-6 uppercase">
              THE MAGUEY EXPERIENCE
            </h2>
            <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#39B54A] to-transparent mx-auto mb-6" />
            <p className="text-white/70 text-lg leading-relaxed max-w-2xl mx-auto">
              Step into Delaware's premier nightlife destination. From our stunning main stage 
              to exclusive VIP areas, every corner of Maguey is designed for unforgettable moments.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Uniform Gallery Grid - All Same Size */}
      <section className="px-4 md:px-16 lg:px-20 pb-20 bg-black">
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {galleryImages.map((image, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="relative overflow-hidden rounded-xl group cursor-pointer"
                onClick={() => setSelectedImage(index)}
              >
                {/* Fixed aspect ratio container - all images same size */}
                <div className="aspect-[4/3] w-full">
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-black border-t border-white/10">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-2xl md:text-4xl font-bold text-white tracking-[0.2em] mb-6 uppercase">
              READY TO EXPERIENCE MAGUEY?
            </h3>
            <p className="text-white/60 mb-8">
              Join us for an unforgettable night of music, dancing, and premium hospitality.
            </p>
            <a 
              href="http://localhost:3016" 
              className="inline-block px-10 py-4 bg-[#39B54A] text-white font-semibold
                         tracking-[0.15em] text-sm uppercase transition-all duration-300 rounded-full
                         hover:bg-[#2d9a3c] hover:shadow-[0_0_30px_rgba(57,181,74,0.3)]"
            >
              Get Tickets
            </a>
          </motion.div>
        </div>
      </section>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedImage !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
            onClick={() => setSelectedImage(null)}
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors z-10"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Navigation Arrows */}
            <button
              onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
              className="absolute left-4 md:left-8 text-white/70 hover:text-white transition-colors z-10 p-2"
            >
              <ChevronLeft className="w-10 h-10" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className="absolute right-4 md:right-8 text-white/70 hover:text-white transition-colors z-10 p-2"
            >
              <ChevronRight className="w-10 h-10" />
            </button>

            {/* Image */}
            <motion.img
              key={selectedImage}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              src={galleryImages[selectedImage].src}
              alt={galleryImages[selectedImage].alt}
              className="max-h-[85vh] max-w-[90vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Image Info */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
              <p className="text-white font-light tracking-widest">
                {galleryImages[selectedImage].alt}
              </p>
              <p className="text-white/50 text-sm mt-1">
                {selectedImage + 1} / {galleryImages.length}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
};

export default Gallery;
