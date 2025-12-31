import { Button } from "@/components/ui/button";
import heroImage from "@/Pictures/hero-main.jpg";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { getPurchaseSiteBaseUrl } from "@/lib/purchaseSiteConfig";
import { Volume2, VolumeX } from "lucide-react";

const Hero = () => {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const { scrollYProgress } = useScroll({ 
    target: ref, 
    offset: ["start start","end start"],
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

  const buttonVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 20 },
    show: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      transition: {
        delay: 1.5,
        type: "spring",
        stiffness: 200,
        damping: 15,
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
          <source src="/Maguey-nights-hero.mp4" type="video/mp4" />
          <source src="/1209.mov" type="video/quicktime" />
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
        {/* Main Title with Letter Animation */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mb-8"
          aria-label="Club brand"
        >
          <motion.h1 className="text-7xl md:text-9xl lg:text-[11rem] font-black tracking-wider leading-none flex justify-center items-center gap-2 md:gap-4">
            {letters.map((letter, index) => (
              <motion.span
                key={index}
                variants={letterVariants}
                className="text-white drop-shadow-[0_0_30px_rgba(57,181,74,0.5)]"
                style={{
                  textShadow: "0 0 20px rgba(57, 181, 74, 0.5), 0 0 40px rgba(57, 181, 74, 0.3)",
                }}
              >
                {letter === " " ? "\u00A0" : letter}
              </motion.span>
            ))}
          </motion.h1>
          
          {/* Subtitle */}
          <motion.h2
            variants={subtitleVariants}
            initial="hidden"
            animate="show"
            className="mt-4 text-2xl md:text-4xl lg:text-5xl font-light text-white/90 tracking-[0.3em] uppercase"
            style={{
              textShadow: "0 0 10px rgba(255, 255, 255, 0.3)",
            }}
          >
            DELAWARE
          </motion.h2>
        </motion.div>

        {/* Animated Button */}
        <motion.div
          variants={buttonVariants}
          initial="hidden"
          animate="show"
        >
          <div>
            <a 
              href={getPurchaseSiteBaseUrl() || "http://localhost:5173/"}
              target="_self"
              className="inline-block"
            >
              <Button
                size="lg"
                className="group bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/15 text-xl px-10 py-6 font-semibold tracking-wider rounded-2xl shadow-[0_0_30px_rgba(57,181,74,0.4)] transition-all duration-300 relative overflow-hidden"
              >
                {/* Animated glow effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  animate={{
                    x: ["-100%", "100%"],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 1,
                    ease: "linear",
                  }}
                />
                <span className="relative z-10">
                  BUY TICKETS
                  <span className="absolute -inset-1 -z-10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 glow" />
                </span>
              </Button>
            </a>
          </div>
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
