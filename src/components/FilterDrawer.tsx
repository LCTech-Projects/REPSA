import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FilterField } from "./inputs/FilterField";

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  availableYears: number[];
  selectedYear: number | null;
  onYearChange: (year: number | null) => void;
}

const TRANSITION_MS = 300;

export const FilterDrawer = ({
  isOpen,
  onClose,
  availableYears,
  selectedYear,
  onYearChange,
}: FilterDrawerProps) => {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const yearOptions = availableYears.map((year) => year.toString()).reverse();

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[110] bg-black/50 transition-opacity duration-300 ease-in-out ${
          visible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filter and Control"
        className={`fixed top-0 bottom-0 right-0 z-[110] w-full max-w-[320px] bg-white-1 shadow-xl overflow-y-auto transform transition-transform duration-300 ease-in-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[1.125rem] font-inter font-semibold text-black-1">
              Filter and Control
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-grey-2 hover:text-black-1 transition-colors"
              aria-label="Close filter"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M15 5L5 15M5 5L15 15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-6">
            <FilterField
              label="Year"
              placeholder={selectedYear ? selectedYear.toString() : "Select Year"}
              options={yearOptions}
              selectedValue={selectedYear ? selectedYear.toString() : null}
              onValueChange={(value) => {
                const year = value ? parseInt(value, 10) : null;
                onYearChange(year);
              }}
            />
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
};
