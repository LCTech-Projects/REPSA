import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

type AccordProps = {
  heading: string;
  text: ReactNode;
  click: () => void;
  id: string;
  idArray: string[];
};

const Accord = ({ heading, text, click, id, idArray }: AccordProps) => {
  const isOpen = idArray.includes(id);

  return (
    <motion.div
      layout
      onClick={click}
      className="w-full cursor-pointer overflow-hidden rounded-[10px] border border-black-1/10 p-3.5"
    >
      <div className="flex items-center justify-between gap-3 text-[0.875rem] font-semibold text-black-1 font-inter">
        <span>{heading}</span>
        <motion.svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <path d="M5 7.5L10 12.5L15 7.5" fill="#212121" />
        </motion.svg>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3.5 text-[0.875rem] leading-6 text-grey-2 font-inter">
              {text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Accord;
