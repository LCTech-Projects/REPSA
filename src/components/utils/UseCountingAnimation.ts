import { useEffect, useState } from "react";

export const useCountingAnimation = (
  endValue: number,
  duration: number = 2000,
  startValue: number = 0,
): number => {
  const [currentValue, setCurrentValue] = useState(startValue);

  useEffect(() => {
    setCurrentValue(startValue);

    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 4);

      setCurrentValue(startValue + (endValue - startValue) * easeOut);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCurrentValue(endValue);
      }
    };

    window.requestAnimationFrame(step);
  }, [endValue, duration, startValue]);

  return currentValue;
};
