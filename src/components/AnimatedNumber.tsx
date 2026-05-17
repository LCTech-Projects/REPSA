import { useEffect, useRef } from "react";
import { useCountingAnimation } from "./utils/UseCountingAnimation";

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  duration?: number;
  unit?: string;
  animateOnce?: boolean;
}

export const AnimatedNumber = ({
  value,
  decimals = 0,
  duration = 2000,
  unit = "",
  animateOnce = false,
}: AnimatedNumberProps) => {
  const hasMountedRef = useRef(false);

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  const shouldAnimate = !(animateOnce && hasMountedRef.current);
  const animatedValue = useCountingAnimation(
    value,
    shouldAnimate ? duration : 0,
    shouldAnimate ? 0 : value,
  );

  const formattedValue =
    decimals > 0
      ? animatedValue.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : Math.round(animatedValue).toLocaleString();

  return (
    <>
      {formattedValue}
      {unit && (
        <span className="text-[0.875rem] font-normal text-grey-2 ml-2">
          {unit}
        </span>
      )}
    </>
  );
};
