import { Button } from "@/components/ui/button";
import heroImage from "@/Pictures/hero-main.jpg";
import { motion, useScroll, useTransform, useSpring, Variants } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getPurchaseSiteBaseUrl } from "@/lib/purchaseSiteConfig";
import { Volume2, VolumeX } from "lucide-react";

const Hero = () => {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const smoothScroll = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 25,
    mass: 0.3
  });

  // Enhanced parallax effects (smoothed to avoid jitter)
  const y = useTransform(smoothScroll, [0, 1], ["0%", "30%"]);
  const scale = useTransform(smoothScroll, [0, 1], [1, 1.05]);
  const overlayOpacity = useTransform(smoothScroll, [0, 0.6], [1, 0]);
  const contentOpacity = useTransform(smoothScroll, [0, 0.55], [1, 0.2]);

  // Stagger animation for letters
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  };

  const letterVariants = {
    hidden: {
      opacity: 0,
      y: 50,
      scale: 0.8,
    },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 200,
        damping: 20,
      },
    },
  };

  const subtitleVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.9 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: 1.2,
        duration: 0.8,
        ease: "easeOut",
      },
    },
  };

  const buttonVariants: Variants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: 1.5,
        duration: 1,
        ease: "easeOut" as const,
      },
    },
  };

  const badgeVariants: Variants = {
    hidden: { opacity: 0, scale: 0.8, y: -20 },
    show: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        delay: 0.5,
        type: "spring" as const,
        stiffness: 100,
        damping: 10,
      },
    },
  };

  // Split "MAGUEY" into letters for animation
  const title = "MAGUEY";
  const letters = title.split("");

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMutedState = !videoRef.current.muted;
    videoRef.current.muted = newMutedState;
    setIsMuted(newMutedState);
  };

  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;

    const tryPlay = () => {
      video.play().catch((error) => {
        console.warn("Hero video autoplay prevented:", error);
      });
    };

    if (video.readyState >= 3) {
      tryPlay();
    } else {
      video.addEventListener("canplay", tryPlay, { once: true });
    }

    return () => {
      video.removeEventListener("canplay", tryPlay);
    };
  }, []);

  return (
    <section ref={ref} className="relative h-screen w-full overflow-hidden bg-black">
      {/* Video Background */}
      <motion.div
        className="absolute inset-0"
        style={{ y, scale, willChange: "transform" }}
        aria-hidden
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
        >
          <source src="/Maguey-nights-hero-compressed.mp4" type="video/mp4" />
          <source src="/1209-compressed.mp4" type="video/mp4" />
        </video>
        {/* Fallback image for browsers that cannot play the video */}
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-0"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
      </motion.div>

      {/* Unmute button */}
      <button
        onClick={toggleMute}
        className="absolute right-6 top-6 z-40 rounded-full border border-white/30 bg-black/40 p-3 text-white backdrop-blur-md transition hover:bg-black/60"
        aria-label={isMuted ? "Unmute hero video" : "Mute hero video"}
      >
        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      {/* Animated Overlay with multiple layers */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: overlayOpacity, willChange: "opacity" }}
        aria-hidden
      >
        {/* Base gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80" />

        {/* Animated neon glow effects */}
        <motion.div
          className="absolute inset-0"
          animate={{
            background: [
              "radial-gradient(circle at 20% 30%, rgba(57, 181, 74, 0.15) 0%, transparent 50%)",
              "radial-gradient(circle at 80% 70%, rgba(57, 181, 74, 0.15) 0%, transparent 50%)",
              "radial-gradient(circle at 20% 30%, rgba(57, 181, 74, 0.15) 0%, transparent 50%)",
            ],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Pulsing glow effect */}
        <motion.div
          className="absolute -inset-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#39B54A]/20 via-transparent to-transparent blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Bottom fade */}
        <div className="absolute inset-x-0 -bottom-20 h-56 bg-gradient-to-t from-black/80 to-transparent" />
      </motion.div>

      {/* Content */}
      <motion.div
        className="relative h-full flex flex-col items-center justify-center text-center px-4 z-10"
        style={{ opacity: contentOpacity, willChange: "opacity" }}
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#39B54A]/10 border border-[#39B54A]/20 text-[#39B54A] text-xs font-medium tracking-wide mb-6 shadow-[0_0_10px_rgba(57,181,74,0.15)]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#39B54A] animate-pulse shadow-[0_0_8px_rgba(57,181,74,0.8)]"></span>
          DELAWARE'S PREMIER LATIN NIGHTLIFE
        </motion.div>

        {/* Main Title with Letter Animation */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mb-8"
          aria-label="Club brand"
        >
          <motion.h1
            className="font-newsreader font-normal tracking-tight leading-[0.9] flex flex-col md:block items-center gap-2 md:gap-4 text-white drop-shadow-2xl italic"
            style={{ fontSize: 'clamp(3.5rem, 12vw, 8rem)' }}
          >
            <span className="block md:inline">MAGUEY</span>
            <span className="block md:inline bg-clip-text text-transparent bg-gradient-to-r from-[#39B54A] to-emerald-400 pr-2"> NIGHTS</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={subtitleVariants}
            initial="hidden"
            animate="show"
            className="mt-6 text-lg md:text-xl lg:text-2xl leading-relaxed text-zinc-300 max-w-2xl mx-auto font-light"
          >
            Experience the rhythm of Latin culture with world-class DJs, VIP hospitality, and an atmosphere built for unforgettable moments.
          </motion.p>
        </motion.div>

        {/* Animated Button */}
        <motion.div
          variants={buttonVariants}
          initial="hidden"
          animate="show"
          className="flex flex-col sm:flex-row gap-4 w-full justify-center"
        >
          <a
            href={getPurchaseSiteBaseUrl() || "http://localhost:5173/"}
            target="_self"
            className="inline-block"
          >
            <button className="group inline-flex overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(57,181,74,0.4)] rounded-full pt-[1px] pr-[1px] pb-[1px] pl-[1px] relative items-center justify-center w-full sm:w-auto flex-none">
              <span className="absolute inset-[-100%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_75%,#39B54A_100%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"></span>
              <span className="absolute inset-0 rounded-full bg-zinc-800 transition-opacity duration-300 group-hover:opacity-0"></span>
              <span className="flex items-center justify-center gap-2 transition-colors duration-300 text-white text-sm font-medium bg-gradient-to-b from-[#39B54A] to-green-700 w-full h-full rounded-full pt-3.5 pr-8 pb-3.5 pl-8 relative shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] group-hover:bg-gradient-to-b group-hover:from-green-500 group-hover:to-green-600">
                <span className="relative z-10 tracking-widest uppercase">Buy Tickets</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-ticket w-4 h-4 relative z-10 transition-transform duration-300 group-hover:translate-x-0.5"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" /></svg>
              </span>
            </button>
          </a>

          <Link to="/restaurant">
            <button className="group inline-flex overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] rounded-full pt-[1px] pr-[1px] pb-[1px] pl-[1px] relative items-center justify-center w-full sm:w-auto flex-none text-white">
              <span className="absolute inset-[-100%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_75%,#a1a1aa_100%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"></span>
              <span className="absolute inset-0 rounded-full bg-black transition-opacity duration-300 group-hover:opacity-0"></span>
              <span className="flex items-center justify-center gap-2 transition-colors duration-300 text-zinc-300 group-hover:text-white text-sm font-medium bg-black w-full h-full rounded-full pt-3.5 pr-8 pb-3.5 pl-8 relative shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-utensils w-4 h-4 relative z-10"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></svg>
                <span className="relative z-10 tracking-widest uppercase">Dining</span>
              </span>
            </button>
          </Link>
        </motion.div>

        {/* Enhanced Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2, duration: 0.6, ease: "easeOut" }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          aria-hidden
        >
          <motion.div
            className="w-6 h-10 border-2 border-white/70 rounded-full flex items-start justify-center p-2"
            animate={{
              borderColor: ["rgba(255, 255, 255, 0.7)", "rgba(57, 181, 74, 0.7)", "rgba(255, 255, 255, 0.7)"],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <motion.div
              className="w-1.5 h-3 bg-white rounded-full"
              animate={{
                y: [0, 12, 0],
                opacity: [1, 0.5, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;
