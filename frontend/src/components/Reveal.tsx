import { motion, useInView, type Variants } from "framer-motion";
import { useRef, type ReactNode } from "react";

type Direction = "up" | "down" | "left" | "right" | "fade" | "scale";

interface RevealProps {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  distance?: number;
  amount?: number; // viewport visibility threshold
  once?: boolean;
  className?: string;
  as?: "div" | "section" | "article" | "header" | "footer";
}

const buildVariants = (direction: Direction, distance: number): Variants => {
  const offset: Record<Direction, { x?: number; y?: number; scale?: number }> = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
    fade: {},
    scale: { scale: 0.96 },
  };
  const o = offset[direction];
  return {
    hidden: { opacity: 0, x: 0, y: 0, scale: 1, ...o },
    visible: { opacity: 1, x: 0, y: 0, scale: 1 },
  };
};

export function Reveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.6,
  distance = 24,
  amount = 0.15,
  once = false,
  className,
  as = "div",
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount, once });
  const variants = buildVariants(direction, distance);
  const MotionTag = motion[as] as typeof motion.div;

  return (
    <MotionTag
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={variants}
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </MotionTag>
  );
}

interface StaggerProps {
  children: ReactNode;
  className?: string;
  delayChildren?: number;
  staggerChildren?: number;
  amount?: number;
  once?: boolean;
}

export function Stagger({
  children,
  className,
  delayChildren = 0,
  staggerChildren = 0.08,
  amount = 0.15,
  once = false,
}: StaggerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount, once });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{
        hidden: {},
        visible: { transition: { delayChildren, staggerChildren } },
      }}
    >
      {children}
    </motion.div>
  );
}

export const StaggerItem = ({
  children,
  className,
  distance = 20,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
}) => (
  <motion.div
    className={className}
    variants={{
      hidden: { opacity: 0, y: distance },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
      },
    }}
  >
    {children}
  </motion.div>
);
