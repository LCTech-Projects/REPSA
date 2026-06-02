import { useState, useEffect } from "react";
import { LightIcon } from "../Icons";

const ONBOARDING_SEEN_KEY = "repsa_onboarding_seen";

const hasSeenOnboarding = () =>
  localStorage.getItem(ONBOARDING_SEEN_KEY) === "true";

export const OnboardingModal = () => {
    const [isVisible, setIsVisible] = useState(() => !hasSeenOnboarding());
    const [shouldAnimate, setShouldAnimate] = useState(false);

    useEffect(() => {
        if (isVisible) {
            setTimeout(() => setShouldAnimate(true), 100);
        }
    }, [isVisible]);

    const handleDismiss = () => {
        localStorage.setItem(ONBOARDING_SEEN_KEY, "true");
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[200px] pointer-events-none">
            <div className="absolute inset-0 bg-black/20 pointer-events-auto" onClick={handleDismiss}></div>
            <div className={`relative bg-white-1 rounded-[12px] shadow-lg p-[24px] max-w-[400px] w-full mx-4 pointer-events-auto ${shouldAnimate ? 'reveal-up' : 'opacity-0'}`}>
                <div className="flex items-start justify-between mb-[16px]">
                    <LightIcon />
                    <button
                        onClick={handleDismiss}
                        className="text-black-3 hover:text-black-1 transition-colors"
                        aria-label="Close"
                    >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="cursor-pointer">
                            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                <div className="mb-[24px]">
                    <h3 className="text-black-1 text-[1.25rem] font-inter font-semibold mb-[12px]">
                        First time here?
                    </h3>
                    <p className="text-grey-2 text-[0.875rem] font-inter leading-[1.25rem]">
                        Start with <span className="font-semibold">Explore the map</span> to see where power is missing in Africa
                    </p>
                </div>

                <button
                    onClick={handleDismiss}
                    className="w-[100px] bg-yellow-1 text-blue-1 text-[0.875rem] font-inter font-semibold py-[12px] px-[24px] rounded-[8px] hover:shadow-lg transition-shadow"
                >
                    Got It!
                </button>
            </div>
        </div>
    );
};
