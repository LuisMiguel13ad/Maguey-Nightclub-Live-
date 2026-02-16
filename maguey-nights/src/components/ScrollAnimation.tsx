import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ScrollAnimationProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export const ScrollAnimation = ({ children, delay = 0, className = "" }: ScrollAnimationProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{
        duration: 0.6,
        ease: "easeOut",
        delay: delay
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default ScrollAnimation;

