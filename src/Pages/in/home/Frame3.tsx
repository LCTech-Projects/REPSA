import { useRevealAnimation } from "../../../hooks/useRevealAnimation";

export const Frame3 = () => {
    const { ref: imageRef, isVisible: imageVisible } = useRevealAnimation<HTMLImageElement>();
    const { ref: textRef, isVisible: textVisible } = useRevealAnimation<HTMLDivElement>();

    return (
        <section className="relative w-full bg-grey-3 py-[60px] px-[22px] bg-[url('/images/bg2.png')] bg-cover bg-center bg-no-repeat">
            <img ref={imageRef} src="/images/block3Hero.png" alt="" className={imageVisible ? 'reveal-fade' : 'opacity-0'} />
            <div ref={textRef} className={`absolute bottom-[140px] left-0 max-w-[1125px] px-[44px] text-white-1 ${textVisible ? 'reveal-up' : 'opacity-0'}`}>
                <h3 className="font-inter font-semibold leading-10" style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)' }}>Empowering Communities</h3>
                <p className="leading-7 mt-[16px] font-inter" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.375rem)' }}>Access to clean, reliable energy transform lives, enabling education, healthcare and economic opportunities.</p>
            </div>
        </section>
    );
};