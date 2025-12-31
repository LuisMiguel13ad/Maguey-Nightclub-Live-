import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useEvents } from "@/hooks/useEvents";
import { useEffect, useState } from "react";
import { fetchEventAvailability, type EventAvailability } from "@/services/eventService";
import { getPurchaseEventUrl, getPurchaseSiteBaseUrl } from "@/lib/purchaseSiteConfig";
import { Calendar, Music, Sparkles } from "lucide-react";
import { CinemaArchiveCarousel } from "@/components/CinemaArchiveCarousel";

const UpcomingEvents = () => {
  // Fetch events from Supabase
  const { events, loading, error } = useEvents();
  const [availability, setAvailability] = useState<Record<string, EventAvailability>>({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Fetch availability for each event
  useEffect(() => {
    if (events.length === 0) return;

    const fetchAllAvailability = async () => {
      setLoadingAvailability(true);
      const availabilityMap: Record<string, EventAvailability> = {};

      // Fetch availability for each event
      await Promise.all(
        events.map(async (event) => {
          try {
            const avail = await fetchEventAvailability(event.artist);
            if (avail) {
              availabilityMap[event.id] = avail;
            }
          } catch (err) {
            console.warn(`Failed to fetch availability for ${event.artist}:`, err);
          }
        })
      );

      setAvailability(availabilityMap);
      setLoadingAvailability(false);
    };

    fetchAllAvailability();
  }, [events]);

  // Optimized motion variants for better performance
  const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: "easeOut" }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Navigation */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Navigation />
      </div>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 bg-black">
        <div className="container mx-auto max-w-6xl text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-5xl md:text-7xl font-black text-white mb-6 tracking-wider drop-shadow-[0_0_30px_rgba(255,0,180,0.25)]"
          >
            UPCOMING EVENTS
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            className="text-xl text-white/80 max-w-2xl mx-auto leading-relaxed"
          >
            Experience Delaware's premier Latin nightlife with world-class DJs, live performances, 
            and unforgettable nights at Maguey Nightclub.
          </motion.p>
        </div>
      </section>

      {/* Events Grid */}
      <section className="py-20 px-4 bg-black">
        <div className="container mx-auto max-w-6xl">
          {loading ? (
            <div className="text-center text-white py-12">
              <p>Loading events...</p>
            </div>
          ) : error ? (
            <div className="text-center text-red-400 py-12">
              <p>Error loading events: {error}</p>
            </div>
          ) : events.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-12 text-center">
                <div className="mb-6 flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-purple-500/20 blur-2xl rounded-full" />
                    <div className="relative bg-gradient-to-br from-pink-500/30 to-purple-500/30 rounded-full p-6">
                      <Calendar className="w-16 h-16 text-white" />
                    </div>
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-white mb-4 tracking-wide">
                  Stay Tuned
                </h3>
                <p className="text-white/80 text-lg mb-2 leading-relaxed">
                  We're preparing something amazing for you!
                </p>
                <p className="text-white/60 mb-8">
                  New events are being added regularly. Check back soon or join our waitlist to be the first to know.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white border-0 text-lg px-8 py-6 font-semibold tracking-wider rounded-2xl shadow-[0_0_30px_rgba(255,0,180,0.35)] transition-all duration-300"
                    asChild
                  >
                    <Link to="/contact">
                      <Music className="w-5 h-5 mr-2 inline" />
                      Contact Us
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10 text-lg px-8 py-6 font-semibold tracking-wider rounded-2xl backdrop-blur-md transition-all duration-300"
                    asChild
                  >
                    <Link to="/">
                      <Sparkles className="w-5 h-5 mr-2 inline" />
                      Back Home
                    </Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <CinemaArchiveCarousel events={events} />
          )}
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-4 bg-black">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-4xl md:text-5xl font-black text-white mb-6 tracking-wider drop-shadow-[0_0_30px_rgba(255,0,180,0.25)]"
          >
            READY TO EXPERIENCE MAGUEY?
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            className="text-xl text-white/80 mb-8"
          >
            Book your table or purchase tickets now to secure your spot for an unforgettable night.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <a href={getPurchaseSiteBaseUrl() || "http://localhost:5173/"} target="_self">
              <Button size="lg" className="group bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/15 text-lg px-12 py-6 font-semibold tracking-wider rounded-2xl shadow-[0_0_30px_rgba(255,0,180,0.25)] transition-all duration-300">
                <span className="relative">
                  BUY TICKETS
                  <span className="absolute -inset-1 -z-10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 glow" />
                </span>
              </Button>
            </a>
            <Link to="/">
              <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 text-lg px-12 py-6 font-semibold tracking-wider rounded-2xl backdrop-blur-md transition-all duration-300">
                HOME
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default UpcomingEvents;

