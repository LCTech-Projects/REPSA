import { useRevealAnimation } from "../../../components/utils/UseRevealAnimation";

export const Frame3 = () => {
    const { ref: imageRef, isVisible: imageVisible } = useRevealAnimation<HTMLImageElement>();
    const { ref: textRef, isVisible: textVisible } = useRevealAnimation<HTMLDivElement>();

    return (
        <section className="relative w-full bg-grey-3 py-10 md:py-[60px] px-[22px] bg-[url('/images/bg2.png')] bg-cover bg-center bg-no-repeat">
            <img ref={imageRef} src="/images/block3Hero.png" alt="" className={`w-full h-auto ${imageVisible ? 'reveal-fade' : 'opacity-0'}`} />
            <div ref={textRef} className={`mt-6 md:mt-0 md:absolute md:bottom-[140px] md:left-0 max-w-[1125px] md:px-[44px] text-white-1 ${textVisible ? 'reveal-up' : 'opacity-0'}`}>
                <h3 className="font-inter font-semibold leading-10" style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)' }}>Empowering Communities</h3>
                <p className="leading-7 mt-[16px] font-inter text-black-1 md:text-white-1" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.375rem)' }}>Access to clean, reliable energy transform lives, enabling education, healthcare and economic opportunities.</p>
            </div>
        </section>
    );
};