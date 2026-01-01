"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function Home() {
  return (
      <main style={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        justifyContent: "center", 
        height: "100%", 
        minHeight: "100vh", // Ensure full height for centering
        color: "white",
        fontFamily: "'Inter', sans-serif" 
      }}>
        
        {/* Hero Text */}
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ textAlign: "center", marginBottom: "3rem" }}
        >
          <h1 style={{ 
            fontSize: "4rem", 
            fontWeight: 800, 
            letterSpacing: "-0.05em",
            background: "linear-gradient(to right, #fff, #a78bfa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: "1rem"
          }}>
            SmartLens
          </h1>

        </motion.div>

        {/* Main Action Button - Resized and Enhanced Glow */}
        <motion.div
           initial={{ scale: 0.8, opacity: 0 }}
           animate={{ scale: 1, opacity: 1 }}
           transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 20 }}
        >
          <Link href="/login" passHref>
             <motion.button 
                whileHover={{ 
                    scale: 1.05, 
                    boxShadow: "0 0 40px rgba(167, 139, 250, 0.8), 0 0 80px rgba(139, 92, 246, 0.4)",
                    background: "rgba(255, 255, 255, 0.15)"
                }}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: "0.75rem 2rem", // Reduced padding
                  fontSize: "1.0rem", // Reduced font size
                  fontWeight: "bold",
                  color: "white",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "50px",
                  backdropFilter: "blur(10px)",
                  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1), 0 0 20px rgba(139, 92, 246, 0.2)", // Base glow
                  cursor: "pointer",
                  transition: "background 0.3s ease, box-shadow 0.3s ease",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em"
                }}
             >
               Go to Platform
             </motion.button>
          </Link>
        </motion.div>

        {/* Footer Info */}
        <div style={{
          position: "absolute",
          bottom: "2rem",
          right: "2rem",
          textAlign: "right",
          color: "rgba(255, 255, 255, 0.3)",
          fontSize: "0.8rem"
        }}>
          <p style={{ margin: 0 }}>v.α</p>
          <p style={{ margin: 0 }}>Created by Ryo,Kadenokoji</p>
        </div>

      </main>
  );
}
