import { useRevealAnimation } from "../../hooks/useRevealAnimation";

export const FeatureCard = ({ icon, text, subtext }: { icon: string; text: string; subtext: string }) => {
    const { ref, isVisible } = useRevealAnimation<HTMLDivElement>();

    return (
        <div ref={ref} className={`flex flex-col gap-y-[24px] p-[32px] rounded-[8px] bg-white-1 shadow-[0px_0px_10px_0px_rgba(0,0,0,0.1)] ${isVisible ? 'reveal-up' : 'opacity-0'}`}>
            <img src={icon} alt="" className="w-[48px] h-[48px]" />
            <h3 className="text-black-3 text-[1.5rem] font-inter font-semibold leading-[2rem] tracking-normal">{text}</h3>
            <p className="text-black-3 text-[1rem] font-inter leading-[1.5rem] tracking-[0.5%]">{subtext}</p>
        </div>
    );
};