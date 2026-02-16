import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";
import InstagramReelsSection from "@/components/InstagramReelsSection";
import { useEvents } from "@/hooks/useEvents";
import { useNewsletter } from "@/hooks/useNewsletter";
import EventCard from "@/components/EventCard";
import ZoomingRingBackground from "@/components/ZoomingRingBackground";

import eventReggaeton from "@/Pictures/event-reggaeton.jpg";
import eventChampagne from "@/Pictures/event-champagne.jpg";
import eventFiesta from "@/Pictures/event-fiesta.jpg";
import venueMainstage from "@/Pictures/venue-mainstage.jpg";
import { getPurchaseSiteBaseUrl } from "@/lib/purchaseSiteConfig";

const Index = () => {
  const { events, loading } = useEvents();
  const [visibleEventsCount, setVisibleEventsCount] = useState(8);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterMessage, setNewsletterMessage] = useState<string | null>(null);
  const { subscribe, isLoading: newsletterLoading, success: newsletterSuccess, error: newsletterError, reset: resetNewsletter } = useNewsletter();

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;

    const result = await subscribe(newsletterEmail, 'homepage');
    setNewsletterMessage(result.message);

    if (result.success) {
      setNewsletterEmail("");
      // Clear success message after 5 seconds
      setTimeout(() => {
        setNewsletterMessage(null);
        resetNewsletter();
      }, 5000);
    }
  };

  const fanTestimonials = [
    {
      id: "1",
      quote:
        "Maguey turns every celebration into a cinematic moment. The lighting, the dancers, the music—it's the only place our team recommends to VIP clients.",
      name: "Sofía Ramirez",
      title: "Creative Director, Velvet Agency",
      cardClass: "card-1"
    },
    {
      id: "2",
      quote:
        "We brought an entire corporate group for a product launch and ended the night at Maguey. Bottle service was flawless and the crowd fed off the energy.",
      name: "Jordan Miles",
      title: "Experience Lead, Parallel Labs",
      cardClass: "card-2"
    },
    {
      id: "3",
      quote:
        "My partner DJs worldwide and still points to Maguey's sound system as the benchmark. The team treats artists and guests with equal care.",
      name: "Priya Nair",
      title: "Artist Manager, Lumen Collective",
      cardClass: "card-3"
    },
    {
      id: "4",
      quote:
        "Our sales retreats close with a night at Maguey. It’s the perfect mix of hospitality and high-gloss production that keeps clients texting us all week.",
      name: "Emily Carter",
      title: "Revenue Ops, Northwind Media",
      cardClass: "card-4"
    },
    {
      id: "5",
      quote:
        "The ability to customize every detail—from visuals to curated cocktails—makes Maguey the easiest venue to recommend for elite nights out.",
      name: "Mark Johnson",
      title: "VIP Concierge, Helio Experiences",
      cardClass: "card-5"
    },
    {
      id: "6",
      quote:
        "We host quarterly leadership meetups and always end at Maguey. The staff remembers faces, the DJ reads the room, and the night never dips.",
      name: "Michael Reyes",
      title: "Founder, Parallel Ventures",
      cardClass: "card-6"
    }
  ];

  return (
    <div className="min-h-screen bg-transparent text-white">

      {/* Animated Zooming Ring Background */}
      <ZoomingRingBackground />

      <Navigation transparent={true} />

      <Hero />

      {/* Main Content Container - Glassmorphsim */}
      <main className="relative z-0 flex flex-col lg:max-w-[1400px] lg:mx-auto lg:my-8 lg:rounded-[2.5rem] lg:border lg:border-white/5 lg:shadow-2xl lg:shadow-black overflow-hidden">
        {/* Grid Lines Background */}
        <div className="absolute inset-0 w-full h-full pointer-events-none z-0 flex justify-between px-6 md:px-12 opacity-50 md:opacity-100">
          <div className="w-px h-full bg-white/5"></div>
          <div className="w-px h-full bg-white/5 hidden sm:block"></div>
          <div className="w-px h-full bg-white/5 hidden md:block"></div>
          <div className="w-px h-full bg-white/5 hidden lg:block"></div>
          <div className="w-px h-full bg-white/5 hidden xl:block"></div>
          <div className="w-px h-full bg-white/5"></div>
        </div>

        {/* Intro Section */}
        <section className="py-20 px-4 relative z-10">
          <div className="container mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <div className="flex flex-col items-center mb-8">
                <span className="text-[#39B54A] font-bold tracking-widest uppercase text-sm mb-2 animate-pulse">Experience The Best</span>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-newsreader italic font-normal text-white tracking-tight text-center">
                  Voted Best Nightclub in Delaware
                </h2>
                <div className="h-1 w-24 bg-[#39B54A] mt-6 rounded-full shadow-[0_0_15px_rgba(57,181,74,0.8)]" />
              </div>
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
              className="text-lg md:text-xl text-zinc-300 leading-relaxed font-light"
            >
              Welcome to Maguey, Delaware's destination for nightlife, luxury, and rhythm.
              Inspired by Latin culture, world-class sound, and VIP hospitality, every night
              at Maguey is a celebration. Enjoy premium bottle service, top DJs, and an
              atmosphere built for unforgettable moments. Experience the best of Latin music
              with live performances featuring banda, corridos, cumbia norteñas, and more.
            </motion.p>
          </div>
        </section>

        {/* Instagram Reels Section */}
        <div className="relative z-10">
          <InstagramReelsSection />
        </div>

        {/* Light Beam Divider */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-8" />

        {/* Events Section */}
        <section className="py-12 relative z-10">
          <div className="container mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="flex flex-col items-center mb-12">
                <h2 className="text-4xl md:text-5xl font-newsreader italic font-normal text-white tracking-tight text-center">
                  Upcoming Events
                </h2>
                <div className="h-1 w-24 bg-[#39B54A] mt-4 rounded-full shadow-[0_0_15px_rgba(57,181,74,0.8)]" />
              </div>
            </motion.div>
          </div>

          {loading ? (
            <div className="text-center text-white py-20">
              <p>Loading events...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="container mx-auto px-4 pb-12">
              <div className="relative w-full max-w-4xl mx-auto overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_50px_-12px_rgba(57,181,74,0.3)] group">
                {/* Background Image with Parallax-like feel */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
                  style={{
                    backgroundImage: `url(${venueMainstage})`,
                    filter: 'grayscale(100%) brightness(0.3)'
                  }}
                />

                {/* Cinematic Overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/40" />

                {/* Neon Accent Lines */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#39B54A] to-transparent opacity-50" />
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#39B54A] to-transparent opacity-50" />

                <div className="relative z-10 p-8 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12">

                  {/* Text Content */}
                  <div className="flex-1 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#39B54A]/10 border border-[#39B54A]/20 mb-6 backdrop-blur-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#39B54A] animate-pulse" />
                      <span className="text-[#39B54A] text-[10px] font-bold tracking-[0.2em] uppercase">Private Access</span>
                    </div>

                    <h3 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight leading-none italic">
                      UNLEASH THE <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#39B54A] to-emerald-200">NIGHT</span>
                    </h3>

                    <p className="text-white/60 text-sm md:text-base max-w-md leading-relaxed mb-8">
                      An exclusive lineup is being curated for the upcoming season.
                      Unlock the guest list before the public knows.
                    </p>

                    <div className="flex items-center gap-4 text-xs font-mono text-white/30 uppercase tracking-widest">
                      <span>Coming Soon</span>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span>Fall 2026</span>
                    </div>
                  </div>

                  {/* Cyber Access Form */}
                  <div className="w-full md:w-auto min-w-[320px] bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#39B54A]/20 rounded-full blur-[50px] pointer-events-none" />

                    <h4 className="text-white font-bold tracking-wider mb-4 text-sm flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#39B54A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      GET NOTIFIED
                    </h4>

                    <form onSubmit={handleNewsletterSubmit} className="flex flex-col gap-3">
                      <div className="relative group/input">
                        <input
                          type="email"
                          placeholder="vip@example.com"
                          value={newsletterEmail}
                          onChange={(e) => setNewsletterEmail(e.target.value)}
                          disabled={newsletterLoading}
                          className="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:border-[#39B54A]/50 focus:bg-white/10 transition-all placeholder:text-white/20 text-sm"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={newsletterLoading || !newsletterEmail.trim()}
                        className="w-full py-4 bg-[#39B54A] hover:bg-[#2d963d] text-black font-bold tracking-widest uppercase rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(57,181,74,0.3)] disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                      >
                        {newsletterLoading ? "GRANTING ACCESS..." : "JOIN GUEST LIST"}
                      </button>

                      {/* Feedback Message */}
                      {newsletterMessage && (
                        <div className={`mt-2 text-xs text-center font-medium py-2 rounded-lg bg-black/50 border ${newsletterSuccess ? 'border-[#39B54A]/30 text-[#39B54A]' : 'border-red-500/30 text-red-400'}`}>
                          {newsletterMessage}
                        </div>
                      )}
                    </form>
                  </div>

                </div>
              </div>
            </div>
          ) : (
            <div className="container mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {events.slice(0, visibleEventsCount).map((event) => (
                <div key={event.id} className="h-full">
                  <EventCard
                    image={event.image}
                    artist={event.artist}
                    schedule={event.scheduleLabel}
                    location={event.locationLine}
                    eventId={event.eventId}
                    purchaseUrl={event.purchaseUrl}
                    category={event.category}
                    status={event.status}
                    tags={event.tags}
                    bannerUrl={event.bannerUrl}
                  />
                </div>
              ))}
            </div>
          )}

          {events.length > visibleEventsCount && (
            <div className="py-12 text-center">
              <button
                onClick={() => setVisibleEventsCount(events.length)}
                className="inline-flex items-center px-8 py-4 bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/15 font-semibold tracking-wider rounded-2xl shadow-[0_0_30px_rgba(255,0,180,0.25)] transition-all duration-300 cursor-pointer"
              >
                View All Events
              </button>
            </div>
          )}
        </section>

        {/* Light Beam Divider */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-8" />

        {/* Themed Nights Section */}
        <section className="py-20 px-4 relative z-10">
          <div className="container mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="flex flex-col items-center mb-16">
                <span className="text-[#39B54A] font-bold tracking-widest uppercase text-sm mb-2">Weekly Vibes</span>
                <h2 className="text-4xl md:text-5xl font-newsreader italic font-normal text-white tracking-tight text-center">
                  Themed Nights
                </h2>
                <div className="h-1 w-24 bg-[#39B54A] mt-4 rounded-full shadow-[0_0_15px_rgba(57,181,74,0.8)]" />
              </div>
            </motion.div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Restaurant */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                className="relative overflow-hidden rounded-2xl h-80 group cursor-pointer bg-white/5 backdrop-blur-md border border-white/10 shadow-lg hover:shadow-2xl transition-all duration-500 hover:border-[#39B54A]/30"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 group-hover:scale-110"
                  style={{
                    backgroundImage: `url(${eventReggaeton})`,
                    filter: 'brightness(0.4)'
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
                <div className="relative h-full flex flex-col justify-end p-8">
                  <div className="text-xs text-gray-300 uppercase tracking-wider mb-2">
                    FINE DINING
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-wide transform hover:scale-105 transition-transform duration-500" style={{ textShadow: '2px 2px 0px #ff6b6b, 4px 4px 0px #4ecdc4, 6px 6px 0px #45b7d1' }}>
                    RESTAURANT
                  </h3>
                  <p className="text-white text-sm leading-relaxed mb-6">
                    Experience exquisite dining with authentic Latin cuisine. Enjoy premium dishes,
                    craft cocktails, and an elegant atmosphere perfect for any occasion.
                  </p>
                  <Link to="/restaurant">
                    <button className="btn-neon-glow group inline-flex items-center px-6 py-3 font-semibold tracking-wider rounded-2xl w-fit">
                      <span className="relative">
                        VIEW MENU
                        <span className="absolute -inset-1 -z-10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 glow" />
                      </span>
                    </button>
                  </Link>
                </div>
              </motion.div>

              {/* Reggaeton Fridays */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                className="relative overflow-hidden rounded-2xl h-80 group cursor-pointer bg-white/5 backdrop-blur-md border border-white/10 shadow-lg hover:shadow-2xl transition-all duration-500 hover:border-[#39B54A]/30"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 group-hover:scale-110"
                  style={{
                    backgroundImage: `url(${eventChampagne})`,
                    filter: 'brightness(0.4)'
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
                <div className="relative h-full flex flex-col justify-end p-8">
                  <div className="text-xs text-gray-300 uppercase tracking-wider mb-2">
                    EVERY FRIDAY
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-wide transform hover:scale-105 transition-transform duration-500" style={{ textShadow: '2px 2px 0px #ff6b6b, 4px 4px 0px #4ecdc4, 6px 6px 0px #45b7d1' }}>
                    REGGAETON FRIDAYS
                  </h3>
                  <p className="text-white text-sm leading-relaxed mb-6">
                    Get ready for the hottest reggaeton night in Delaware. Dance to the latest hits
                    from Bad Bunny, J Balvin, Karol G, and more with our world-class DJs.
                  </p>
                  <a href={getPurchaseSiteBaseUrl() || "http://localhost:5173/"} target="_self">
                    <button className="btn-neon-glow group inline-flex items-center px-6 py-3 font-semibold tracking-wider rounded-2xl w-fit">
                      <span className="relative">
                        BUY TICKETS
                        <span className="absolute -inset-1 -z-10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 glow" />
                      </span>
                    </button>
                  </a>
                </div>
              </motion.div>

              {/* Regional Mexicano */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
                className="relative overflow-hidden rounded-2xl h-80 group cursor-pointer bg-white/5 backdrop-blur-md border border-white/10 shadow-lg hover:shadow-2xl transition-all duration-500 hover:border-[#39B54A]/30"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 group-hover:scale-110"
                  style={{
                    backgroundImage: `url(${eventFiesta})`,
                    filter: 'brightness(0.4)'
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
                <div className="relative h-full flex flex-col justify-end p-8">
                  <div className="text-xs text-gray-300 uppercase tracking-wider mb-2">
                    AUTHENTIC SOUNDS
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-wide transform hover:scale-105 transition-transform duration-500" style={{ textShadow: '2px 2px 0px #ff6b6b, 4px 4px 0px #4ecdc4, 6px 6px 0px #45b7d1' }}>
                    REGIONAL MEXICANO
                  </h3>
                  <p className="text-white text-sm leading-relaxed mb-6">
                    Experience the rich sounds of Mexico with corridos, norteñas, banda, and more.
                    Our live performances bring the authentic Mexican music experience to Delaware.
                  </p>
                  <a href={getPurchaseSiteBaseUrl() || "http://localhost:5173/"} target="_self">
                    <button className="btn-neon-glow group inline-flex items-center px-6 py-3 font-semibold tracking-wider rounded-2xl w-fit">
                      <span className="relative">
                        BUY TICKETS
                        <span className="absolute -inset-1 -z-10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 glow" />
                      </span>
                    </button>
                  </a>
                </div>
              </motion.div>

              {/* Cumbias */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 }}
                className="relative overflow-hidden rounded-2xl h-80 group cursor-pointer bg-white/5 backdrop-blur-md border border-white/10 shadow-lg hover:shadow-2xl transition-all duration-500 hover:border-[#39B54A]/30"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 group-hover:scale-110"
                  style={{
                    backgroundImage: `url(${venueMainstage})`,
                    filter: 'brightness(0.4)'
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
                <div className="relative h-full flex flex-col justify-end p-8">
                  <div className="text-xs text-gray-300 uppercase tracking-wider mb-2">
                    DANCE THE NIGHT AWAY
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-wide transform hover:scale-105 transition-transform duration-500" style={{ textShadow: '2px 2px 0px #ff6b6b, 4px 4px 0px #4ecdc4, 6px 6px 0px #45b7d1' }}>
                    CUMBIAS
                  </h3>
                  <p className="text-white text-sm leading-relaxed mb-6">
                    Feel the rhythm of cumbia music that gets everyone on the dance floor.
                    From classic hits to modern cumbia, experience the infectious beats that define Latin culture.
                  </p>
                  <a href={getPurchaseSiteBaseUrl() || "http://localhost:5173/"} target="_self">
                    <button className="btn-neon-glow group inline-flex items-center px-6 py-3 font-semibold tracking-wider rounded-2xl w-fit">
                      <span className="relative">
                        BUY TICKETS
                        <span className="absolute -inset-1 -z-10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 glow" />
                      </span>
                    </button>
                  </a>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Light Beam Divider */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-8" />

        {/* Maguey Fan Stories Section */}
        <section className="border-t border-white/5 py-20 px-4 relative z-10">
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div className="mb-8 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1">
                <span className="h-2 w-2 rounded-full bg-pink-400" />
                <span className="text-xs uppercase tracking-[0.3em] font-semibold text-white/70">
                  Loved by nightlife insiders
                </span>
              </div>
            </div>
            <motion.h3
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="text-center text-4xl md:text-5xl lg:text-6xl font-newsreader italic font-normal tracking-tight text-white mb-4"
            >
              <span className="text-[#39B54A]">Maguey</span> Fan Stories
            </motion.h3>
            <p className="text-center text-lg text-white/70 max-w-2xl mx-auto mb-12 font-light">
              Producers, creative leads, and VIP hosts rely on Maguey to deliver iconic nights and unforgettable hospitality—
              here's how they describe the experience.
            </p>
            <div
              className="testimonial-cards-fan group relative mx-auto flex h-[42rem] w-full max-w-7xl items-center justify-center"
            >
              {fanTestimonials.map((testimonial) => (
                <article
                  key={testimonial.id}
                  className={`testimonial-card ${testimonial.cardClass} w-full max-w-sm rounded-2xl border border-white/10 bg-black/80 px-6 py-6 text-left overflow-hidden`}
                >
                  <div className="relative z-10">
                    <div className="mb-3 text-3xl leading-none text-white">"</div>
                    <p className="text-base text-white/80">{testimonial.quote}</p>
                    <div className="mt-5 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-white/10" />
                      <div>
                        <div className="text-sm text-white font-semibold">{testimonial.name}</div>
                        <div className="text-xs text-white/60">{testimonial.title}</div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
};

export default Index;
