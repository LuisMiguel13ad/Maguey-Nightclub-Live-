/**
 * Auth Switch Component
 * Animated toggle between login and signup modes with sliding indicator
 * Features smooth spring animations and brand color integration
 */

import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

interface AuthSwitchProps {
  className?: string;
}

export function AuthSwitch({ className }: AuthSwitchProps) {
  const location = useLocation();
  const isLogin = location.pathname === "/login";
  const isSignup = location.pathname === "/signup";

  return (
    <div className={cn(
      "relative flex items-center gap-1 p-1.5 rounded-lg",
      "bg-muted/30 border border-border/50 backdrop-blur-sm",
      "overflow-hidden",
      className
    )}>
      {/* Animated sliding background indicator */}
      <motion.div
        className="absolute top-1.5 bottom-1.5 rounded-md bg-gradient-primary shadow-glow-primary/50"
        initial={false}
        animate={{
          left: isLogin ? "0.375rem" : "calc(50% + 0.125rem)",
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 35,
        }}
        style={{
          width: "calc(50% - 0.375rem)",
        }}
      />

      {/* Sign In Button */}
      <motion.div
        className="relative z-10 flex-1"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Link
          to="/login"
          className={cn(
            "block px-4 py-2 text-sm font-medium rounded-md text-center",
            "transition-colors duration-200 relative",
            isLogin
              ? "text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Sign In
        </Link>
      </motion.div>

      {/* Sign Up Button */}
      <motion.div
        className="relative z-10 flex-1"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Link
          to="/signup"
          className={cn(
            "block px-4 py-2 text-sm font-medium rounded-md text-center",
            "transition-colors duration-200 relative",
            isSignup
              ? "text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Sign Up
        </Link>
      </motion.div>
    </div>
  );
}
