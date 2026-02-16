import { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import { Instagram, Pause, Play, ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';

// Video files from /public/videos/
const reelVideos = [
  { src: '/videos/SnapInsta.to_AQMJ2xguIlNIFKct88w83XbJVW6gSO5kyZ_Q4A4EU5IBNCH5P672rpzThp8g37Zi0URR1gcq03qBV4A3UHA1m1MAG5UMTmXcvewkZ-I.mp4', instagramUrl: 'https://www.instagram.com/magueynightclub' },
  { src: '/videos/SnapInsta.to_AQMTQMNKvS8QTdb4xE4qZhleunEmKe3A3e2x1ILWSHOwrIkbTQspE0kwhg4SX69N83finvJE3ilYB-QbIm_CKMeidUMh2BcJmJduca0.mp4', instagramUrl: 'https://www.instagram.com/magueynightclub' },
  { src: '/videos/SnapInsta.to_AQN8994Klt-H4_oTNgKbX0dkYvYV8Zy2ORErlqbfubTwp9zXcboh7Ri9cnZXuO8NNnlUTToiolvak5t6Py-6onUKm1K700-kXT0p1fs.mp4', instagramUrl: 'https://www.instagram.com/magueynightclub' },
  { src: '/videos/SnapInsta.to_AQNCZh38o7DYAYv9_rMFwr1Biv6Jy83RI_DAtIXAg3fQKJIDKC0n82P4GGlXub-y2nwEmSeAh1ttmF9oG2Ruz80FjyObQHIY-rT4jsk.mp4', instagramUrl: 'https://www.instagram.com/magueynightclub' },
  { src: '/videos/SnapInsta.to_AQOqmy2-CAC7Uowe0Tterwe0n1Zsn3LTGTpTn_vs61H1DzkII_BukyslcczSKvZ2m_uwZ3J8MIgpq-VhPGRHiW99YEuY_3BHhZ-uNA0.mp4', instagramUrl: 'https://www.instagram.com/magueynightclub' },
  { src: '/videos/SnapInsta.to_AQPd48PUrYPl0Y6kCoM3AqhK5lSXgG9d_LQrplZe9v1jN9XGxZPoVF-GcizZaAqN-w0AOGOkGJcfgLkItZM_c-7hS3KAGkwjT_R2KTU.mp4', instagramUrl: 'https://www.instagram.com/magueynightclub' },
  { src: '/videos/SnapInsta.to_AQPv_rUeoemS5uzynzPZGCI6JRzmGkGYvzIgTQfr09C4UcH52jU8yDjrFG-1MqcqSK9VgfTcIumn3oNxgA4cB-lrY6XY7mPyNBCG5pw.mp4', instagramUrl: 'https://www.instagram.com/magueynightclub' },
  { src: '/videos/SnapInsta.to_AQPzAqp3VpalS2WjM6Vr2X-Bj4o9VhOOgx80Cs5caZOGmVZNZNNCTHm6c3dCk9qZC5hCtaKGwuVbGudxtXMq1-9F8PZl2AmhRTUYrx4.mp4', instagramUrl: 'https://www.instagram.com/magueynightclub' },
];

interface VideoCardProps {
  src: string;
  instagramUrl: string;
  index: number;
  globalPaused: boolean;
}

const VideoCard = ({ src, instagramUrl, index, globalPaused }: VideoCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(cardRef, { margin: "-20% 0px -20% 0px" });

  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      // Logic: Only play if:
      // 1. Element is in view (performance)
      // 2. Global pause is OFF
      // 3. Local pause is OFF
      const shouldPlay = isInView && !globalPaused && !isPaused;

      if (shouldPlay) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Autoplay prevented
          });
        }
      } else {
        videoRef.current.pause();
      }
    }
  }, [isInView, globalPaused, isPaused]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPaused(!isPaused);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  const handleVideoClick = () => {
    window.open(instagramUrl, '_blank');
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      className="flex-shrink-0 relative group"
    >
      <div
        className="relative w-[280px] h-[500px] rounded-sm overflow-hidden cursor-pointer bg-black border border-white/10 group-hover:border-[#39B54A]/50 transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(57,181,74,0.15)]"
        onClick={handleVideoClick}
      >
        {/* Glow Element */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 z-10 pointer-events-none" />

        {/* Video */}
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
          muted={isMuted}
          loop
          playsInline
          onLoadedData={() => setIsLoaded(true)}
        />

        {/* Loading placeholder */}
        {!isLoaded && (
          <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center z-0">
            <div className="w-10 h-10 border-2 border-[#39B54A] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Overlay Content */}
        <div className="absolute inset-0 z-20 p-4 flex flex-col justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {/* Top Bar */}
          <div className="flex justify-between items-start">
            <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10">
              <Instagram className="w-4 h-4 text-white" />
            </div>
            <button
              onClick={toggleMute}
              className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-[#39B54A] hover:text-black hover:border-[#39B54A] transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Bottom Bar */}
          <div className="flex justify-end">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-[#39B54A] hover:text-black transition-colors border border-white/20"
            >
              {isPaused || globalPaused ? (
                <Play className="w-5 h-5 ml-1" />
              ) : (
                <Pause className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const InstagramReelsSection = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [globalPaused, setGlobalPaused] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<'right' | 'left'>('right');

  // Auto-scroll animation logic
  useEffect(() => {
    if (globalPaused) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollSpeed = 0.5; // Smooth slow scroll
    let animationId: number;
    // We'll use a simpler persistent scroll for reliability

    const animate = () => {
      if (!container) return;

      const maxScroll = container.scrollWidth - container.clientWidth;

      if (scrollDirection === 'right') {
        container.scrollLeft += scrollSpeed;
        if (container.scrollLeft >= maxScroll - 1) {
          setScrollDirection('left');
        }
      } else {
        container.scrollLeft -= scrollSpeed;
        if (container.scrollLeft <= 1) {
          setScrollDirection('right');
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [globalPaused, scrollDirection]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const toggleGlobalPause = () => {
    setGlobalPaused(!globalPaused);
  };

  return (
    <section className="py-24 relative bg-transparent overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#39B54A]/50 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#39B54A]/20 to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header - Unified Design */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-8">
          <div className="text-center md:text-left">
            <span className="text-[#39B54A] font-bold tracking-[0.2em] text-xs uppercase mb-2 block animate-pulse">
              Live Feed
            </span>
            <motion.h2
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-black text-white tracking-tight uppercase text-neon"
            >
              @MAGUEYNIGHTCLUB
            </motion.h2>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => scroll('left')}
              className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:text-[#39B54A] hover:border-[#39B54A] hover:bg-[#39B54A]/10 transition-all duration-300"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={toggleGlobalPause}
              className="w-12 h-12 rounded-full border border-[#39B54A]/30 bg-[#39B54A]/10 flex items-center justify-center text-[#39B54A] hover:bg-[#39B54A] hover:text-black transition-all duration-300 shadow-[0_0_15px_rgba(57,181,74,0.2)]"
            >
              {globalPaused ? (
                <Play className="w-5 h-5 ml-1" />
              ) : (
                <Pause className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={() => scroll('right')}
              className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:text-[#39B54A] hover:border-[#39B54A] hover:bg-[#39B54A]/10 transition-all duration-300"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Carousel */}
        <div className="relative -mx-4 md:mx-0">
          <div
            ref={scrollContainerRef}
            className="flex gap-6 overflow-x-auto pb-8 
            px-4 md:px-0
            scrollbar-hide"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            {reelVideos.map((video, index) => (
              <VideoCard
                key={index}
                src={video.src}
                instagramUrl={video.instagramUrl}
                index={index}
                globalPaused={globalPaused}
              />
            ))}
          </div>

          {/* Gradient Edges to fade out content */}
          <div className="absolute top-0 left-0 w-8 md:w-32 h-full bg-gradient-to-r from-black/80 via-black/40 to-transparent pointer-events-none z-10 hidden md:block" />
          <div className="absolute top-0 right-0 w-8 md:w-32 h-full bg-gradient-to-l from-black/80 via-black/40 to-transparent pointer-events-none z-10 hidden md:block" />
        </div>

        {/* Interactive Footer */}
        <div className="text-center mt-8">
          <a
            href="https://www.instagram.com/magueynightclub"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center gap-3 px-10 py-5 bg-transparent overflow-hidden rounded-full transition-transform hover:scale-105 duration-300"
          >
            {/* Button Background with Instagram Gradient as Border/Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 opacity-20 blur-xl group-hover:opacity-40 transition-opacity" />
            <div className="absolute inset-0 border border-white/20 rounded-full group-hover:border-white/50 transition-colors" />

            {/* Icon & Text */}
            <Instagram className="w-6 h-6 text-white group-hover:text-pink-400 transition-colors" />
            <span className="relative font-bold tracking-widest text-white text-sm md:text-base">
              FOLLOW @MAGUEYNIGHTCLUB
            </span>

            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          </a>

          <p className="mt-4 text-white/30 text-xs tracking-widest uppercase">
            Tag us to get featured
          </p>
        </div>
      </div>
    </section>
  );
};

export default InstagramReelsSection;
