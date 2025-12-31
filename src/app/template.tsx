"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Define paths where the transition should be active
  // ROOT <-> Login
  // Pending <-> Dashboard
  const activePaths = ["/", "/login", "/pending", "/dashboard"];
  const shouldAnimate = activePaths.includes(pathname);

  if (!shouldAnimate) {
      return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, filter: "blur(10px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 1.02, filter: "blur(10px)" }}
      transition={{ 
          type: "spring",
          stiffness: 100,
          damping: 20,
          mass: 0.5,
          duration: 0.5 
      }}
      style={{ width: "100%", height: "100%" }}
    >
      {children}
    </motion.div>
  );
}
