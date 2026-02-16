import { motion } from "framer-motion";
import { useMemo } from "react";

const ShootingBeamBackground = () => {
    // Generate sparks/particles that will float up
    const sparks = useMemo(() =>
        Array.from({ length: 20 }).map((_, i) => ({
            id: i,
            left: 10 + Math.random() * 80, // Random horizontal position 10% - 90%
            size: 1 + Math.random() * 3, // Random size
            duration: 2 + Math.random() * 4, // Random duration
            delay: Math.random() * 5, // Random start delay
            opacity: 0.3 + Math.random() * 0.5,
        })), []
    );

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-black">

            {/* Central Beam Container */}
            <div className="absolute inset-0 flex justify-center items-end">

                {/* Core Beam - Intense Green */}
                <motion.div
                    className="absolute bottom-0 w-[4px] md:w-[6px] origin-bottom rounded-t-full z-10"
                    style={{
                        height: '100vh',
                        background: 'linear-gradient(to top, #ffffff 0%, #39B54A 20%, transparent 80%)',
                        boxShadow: '0 0 30px 5px rgba(57, 181, 74, 0.6)',
                        filter: 'blur(1px)',
                    }}
                    animate={{
                        scaleY: [0, 1.2],
                        opacity: [0, 1, 0],
                    }}
                    transition={{
                        duration: 2, // Fast shooting speed
                        repeat: Infinity,
                        repeatDelay: 0.5,
                        ease: "circOut", // Explosive start
                    }}
                />

                {/* Secondary Outer Beam - Wider Glow */}
                <motion.div
                    className="absolute bottom-0 w-[40px] md:w-[60px] origin-bottom z-0"
                    style={{
                        height: '100vh',
                        background: 'linear-gradient(to top, rgba(57, 181, 74, 0.4) 0%, transparent 60%)',
                        filter: 'blur(20px)',
                    }}
                    animate={{
                        scaleY: [0, 1.1],
                        opacity: [0, 0.5, 0],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatDelay: 0.5,
                        ease: "circOut",
                    }}
                />

                {/* Impact/Source Glow at Bottom */}
                <motion.div
                    className="absolute bottom-[-50px] w-[300px] h-[150px] rounded-full bg-[#39B54A] blur-[60px]"
                    animate={{
                        opacity: [0.2, 0.6, 0.2],
                        scale: [1, 1.2, 1],
                    }}
                    transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            </div>

            {/* Rising Particles */}
            {sparks.map((spark) => (
                <motion.div
                    key={`spark-${spark.id}`}
                    className="absolute rounded-full bg-[#39B54A]"
                    style={{
                        bottom: '-10px',
                        left: `${spark.left}%`,
                        width: `${spark.size}px`,
                        height: `${spark.size}px`,
                        boxShadow: `0 0 ${spark.size * 2}px #39B54A`,
                        opacity: spark.opacity,
                    }}
                    animate={{
                        y: [0, -window.innerHeight * 1.2], // Move up past screen
                        opacity: [0, spark.opacity, 0],
                    }}
                    transition={{
                        duration: spark.duration,
                        repeat: Infinity,
                        delay: spark.delay,
                        ease: "linear",
                    }}
                />
            ))}

            {/* Ambient Vignette */}
            <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black/80 pointer-events-none" />
        </div>
    );
};

export const ZoomingRingBackground = ShootingBeamBackground;
export default ShootingBeamBackground;
