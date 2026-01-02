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
    <div className="min-h-screen bg-background">
      {/* Navigation overlay on hero */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Navigation transparent={true} />
      </div>
      
      <Hero />

      {/* Intro Section */}
      <section className="py-20 px-4 bg-black">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-6 tracking-widest text-[#39B54A]"
            style={{WebkitTextStroke: '1px white', color: 'transparent', textShadow: '3px 3px 6px rgba(255, 255, 255, 0.6)', animation: 'glow 4s ease-in-out infinite'}}
          >
            VOTED BEST NIGHTCLUB IN DELAWARE
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            className="text-lg md:text-xl text-white/80 leading-relaxed"
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
      <InstagramReelsSection />

      {/* Light Beam Divider */}
      <div className="section-divider" />

      {/* Events Section */}
      <section className="bg-black">
         <div className="container mx-auto py-12">
          <motion.h2 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-2xl md:text-3xl font-bold text-center mb-6 tracking-widest text-[#39B54A]" 
            style={{WebkitTextStroke: '1px white', color: 'transparent', textShadow: '2px 2px 4px rgba(255, 255, 255, 0.5)', animation: 'glow 4s ease-in-out infinite'}}
          >
            UPCOMING EVENTS
          </motion.h2>
        </div>

          {loading ? (
            <div className="text-center text-white py-20">
              <p>Loading events...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="container mx-auto px-4 pb-12">
              <div className="max-w-xl mx-auto bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-center">
                {/* Calendar Icon */}
                <div className="w-16 h-16 mx-auto mb-5 rounded-full border-2 border-[#39B54A]/30 flex items-center justify-center bg-[#39B54A]/10">
                  <svg className="w-8 h-8 text-[#39B54A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                
                {/* Heading */}
                <h3 className="text-2xl md:text-3xl font-light text-white mb-2 italic">
                  The Night Awaits
                </h3>
                
                {/* Subtitle */}
                <p className="text-[#39B54A] text-xs tracking-[0.3em] uppercase mb-4">
                  NEW EVENTS COMING SOON
                </p>
                
                {/* Description */}
                <p className="text-white/60 text-sm mb-6">
                  Something big is brewing. Sign up to hear it first.
                </p>
                
                {/* Email Signup */}
                <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto mb-3">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    disabled={newsletterLoading}
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none focus:border-[#39B54A]/50 transition-colors disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={newsletterLoading || !newsletterEmail.trim()}
                    className="px-5 py-3 bg-[#39B54A] text-black text-sm font-bold tracking-wider uppercase rounded-lg hover:bg-[#2d9a3c] transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {newsletterLoading ? "..." : "NOTIFY ME"}
                  </button>
                </form>

                {/* Feedback Message */}
                {newsletterMessage && (
                  <p className={`text-sm mb-2 ${newsletterSuccess ? 'text-[#39B54A]' : 'text-red-400'}`}>
                    {newsletterMessage}
                  </p>
                )}

                {/* Disclaimer */}
                <p className="text-white/40 text-xs">
                  No spam, just vibes. Unsubscribe anytime.
                </p>
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
      <div className="section-divider section-divider-reverse" />

      {/* Themed Nights Section */}
      <section className="py-20 px-4 bg-black">
        <div className="container mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-2xl md:text-3xl font-bold text-center mb-12 tracking-widest text-[#39B54A]"
            style={{WebkitTextStroke: '1px white', color: 'transparent', textShadow: '2px 2px 4px rgba(255, 255, 255, 0.5)', animation: 'glow 4s ease-in-out infinite'}}
          >
            THEMED NIGHTS
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Restaurant */}
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
              className="relative overflow-hidden rounded-2xl h-80 group cursor-pointer bg-white/5 backdrop-blur-md border border-white/20 shadow-lg hover:shadow-2xl transition-all duration-500"
            >
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
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
                <h3 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-wide transform hover:scale-110 hover:skew-x-2 transition-all duration-300 active:scale-95" style={{textShadow: '2px 2px 0px #ff6b6b, 4px 4px 0px #4ecdc4, 6px 6px 0px #45b7d1'}}>
                  RESTAURANT
                </h3>
                <p className="text-white text-sm leading-relaxed mb-6">
                  Experience exquisite dining with authentic Latin cuisine. Enjoy premium dishes, 
                  craft cocktails, and an elegant atmosphere perfect for any occasion.
                </p>
                <Link to="/restaurant">
                  <button className="group inline-flex items-center px-6 py-3 bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/15 font-semibold tracking-wider rounded-2xl shadow-[0_0_30px_rgba(255,0,180,0.25)] transition-all duration-300 w-fit">
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
              className="relative overflow-hidden rounded-2xl h-80 group cursor-pointer bg-white/5 backdrop-blur-md border border-white/20 shadow-lg hover:shadow-2xl transition-all duration-500"
            >
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
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
                <h3 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-wide transform hover:scale-110 hover:skew-x-2 transition-all duration-300 active:scale-95" style={{textShadow: '2px 2px 0px #ff6b6b, 4px 4px 0px #4ecdc4, 6px 6px 0px #45b7d1'}}>
                  REGGAETON FRIDAYS
                </h3>
                <p className="text-white text-sm leading-relaxed mb-6">
                  Get ready for the hottest reggaeton night in Delaware. Dance to the latest hits 
                  from Bad Bunny, J Balvin, Karol G, and more with our world-class DJs.
                </p>
                <a href={getPurchaseSiteBaseUrl() || "http://localhost:5173/"} target="_self">
                  <button className="group inline-flex items-center px-6 py-3 bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/15 font-semibold tracking-wider rounded-2xl shadow-[0_0_30px_rgba(255,0,180,0.25)] transition-all duration-300 w-fit">
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
              className="relative overflow-hidden rounded-2xl h-80 group cursor-pointer bg-white/5 backdrop-blur-md border border-white/20 shadow-lg hover:shadow-2xl transition-all duration-500"
            >
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
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
                <h3 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-wide transform hover:scale-110 hover:skew-x-2 transition-all duration-300 active:scale-95" style={{textShadow: '2px 2px 0px #ff6b6b, 4px 4px 0px #4ecdc4, 6px 6px 0px #45b7d1'}}>
                  REGIONAL MEXICANO
                </h3>
                <p className="text-white text-sm leading-relaxed mb-6">
                  Experience the rich sounds of Mexico with corridos, norteñas, banda, and more. 
                  Our live performances bring the authentic Mexican music experience to Delaware.
                </p>
                <a href={getPurchaseSiteBaseUrl() || "http://localhost:5173/"} target="_self">
                  <button className="group inline-flex items-center px-6 py-3 bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/15 font-semibold tracking-wider rounded-2xl shadow-[0_0_30px_rgba(255,0,180,0.25)] transition-all duration-300 w-fit">
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
              className="relative overflow-hidden rounded-2xl h-80 group cursor-pointer bg-white/5 backdrop-blur-md border border-white/20 shadow-lg hover:shadow-2xl transition-all duration-500"
            >
              <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
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
                <h3 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-wide transform hover:scale-110 hover:skew-x-2 transition-all duration-300 active:scale-95" style={{textShadow: '2px 2px 0px #ff6b6b, 4px 4px 0px #4ecdc4, 6px 6px 0px #45b7d1'}}>
                  CUMBIAS
                </h3>
                <p className="text-white text-sm leading-relaxed mb-6">
                  Feel the rhythm of cumbia music that gets everyone on the dance floor. 
                  From classic hits to modern cumbia, experience the infectious beats that define Latin culture.
                </p>
                <a href={getPurchaseSiteBaseUrl() || "http://localhost:5173/"} target="_self">
                  <button className="group inline-flex items-center px-6 py-3 bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/15 font-semibold tracking-wider rounded-2xl shadow-[0_0_30px_rgba(255,0,180,0.25)] transition-all duration-300 w-fit">
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
      <div className="section-divider-glow" />

      {/* Maguey Fan Stories Section */}
      <section className="border-y border-white/5 bg-black py-20 px-4">
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
            className="text-center text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white mb-4"
          >
            <span className="text-[#39B54A]">Maguey</span> Fan Stories
          </motion.h3>
          <p className="text-center text-lg text-white/70 max-w-2xl mx-auto mb-12">
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
    </div>
  );
};

export default Index;
