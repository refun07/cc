import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// Shared easing/timing tokens (ease-out enter, 150–400ms range).
export const EASE = [0.22, 1, 0.36, 1];

/**
 * Mobile WebKit can miss an IntersectionObserver update during a route change,
 * leaving reveal content stuck at opacity: 0 until the next tap/repaint. Touch
 * devices get the content immediately; pointer-based layouts keep the reveal.
 */
function useImmediateContent() {
  const reduce = useReducedMotion();
  const [touchDevice, setTouchDevice] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(hover: none), (pointer: coarse)").matches
      : false
  );

  useEffect(() => {
    const query = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setTouchDevice(query.matches);

    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return reduce || touchDevice;
}

/** Scroll-reveal wrapper. Fades + lifts into view once; respects reduced-motion. */
export function Reveal({ children, delay = 0, y = 24, className = "", as = "div" }) {
  const immediate = useImmediateContent();
  const MotionTag = motion[as] || motion.div;
  return (
    <MotionTag
      className={className}
      initial={immediate ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </MotionTag>
  );
}

/** Staggered container — children using `item` variant animate in sequence. */
export function Stagger({ children, className = "", gap = 0.06 }) {
  const immediate = useImmediateContent();

  return (
    <motion.div
      className={className}
      initial={immediate ? "show" : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{ show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

export const item = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/** Counts a number up when it scrolls into view. */
export function useCountUp(target, { duration = 1400 } = {}) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (reduce) {
      setValue(target);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now) => {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
            setValue(target * eased);
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [target, duration, reduce]);

  return [ref, value];
}
