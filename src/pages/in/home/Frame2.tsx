import { FeatureCard } from "../../../components/cards/FeatureCard";
import { WorldIcon } from "../../../components/Icons"
import { features } from "../../../components/utils/Dummy";
import { useRevealAnimation } from "../../../components/utils/UseRevealAnimation";

export const Frame2 = () => {
    const { ref: badgeRef, isVisible: badgeVisible } = useRevealAnimation();
    const { ref: headingRef, isVisible: headingVisible } = useRevealAnimation();
    const { ref: textRef, isVisible: textVisible } = useRevealAnimation();

    return (
        <section className="w-full bg-grey-3 py-[60px] px-[22px]">
            <div className="max-w-[904px] mx-auto flex flex-col gap-y-[24px] items-center text-center">
                <div ref={badgeRef} className={`relative inline-flex items-center justify-center rounded-[100px] p-[2px] shadow-[0px_0px_10px_0px_rgba(0,0,0,0.1)] overflow-hidden ${badgeVisible ? 'reveal-up' : 'opacity-0'}`}>
                    <div
                        className="absolute rounded-[100px]"
                        style={{
                            background: 'conic-gradient(from 0deg, #FFD43B 0%, #FF6B35 25%, #FFD43B 50%, #FF6B35 75%, #FFD43B 100%)',
                            top: '-2px',
                            left: '-2px',
                            right: '-2px',
                            bottom: '-2px'
                        }}
                    ></div>
                    <div className="relative flex items-center justify-center gap-[10px] rounded-[100px] bg-white-1 p-[15px] z-10">
                        <WorldIcon />
                        <span className="text-black-3 text-[0.75rem] font-inter">Renewable Energy Planning for Sustainable Africa</span>
                    </div>
                </div>
                <h2 ref={headingRef} className={`text-blue-1 font-libre font-bold leading-16 tracking-[0.25%] ${headingVisible ? 'reveal-up' : 'opacity-0'}`} style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5625rem)' }}>Can Africa Power Its Future?</h2>
                <p ref={textRef} className={`text-grey-2 text-[1rem] font-inter leading-6 tracking-[0.5%] ${textVisible ? 'reveal-up' : 'opacity-0'}`}>600 million people live without electricity. Millions more cook with wood and charcoal, sacrificing health and opportunity. REPSA puts the power of data in your hands to understand, simulate, and envision pathways to universal energy access.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px] mt-[60px]">
                {features.map((feature, index) => (
                    <FeatureCard key={index} {...feature} />
                ))}
            </div>
        </section>
    );
};