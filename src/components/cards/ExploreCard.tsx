import { Link } from "react-router-dom";
import { ArrowBlueIcon } from "../Icons";
import { useRevealAnimation } from "../../hooks/useRevealAnimation";

export const ExploreCard = ({ icon, tag, text, subtext, features, actionLabel, actionLink, extraClass }: { icon: string; tag?: string; text: string; subtext: string; features: string[]; actionLabel: string; actionLink: string; extraClass?: string }) => {
    const { ref, isVisible } = useRevealAnimation<HTMLDivElement>();

    return (
        <div ref={ref} className={`flex flex-col gap-y-[24px] p-[32px] rounded-[8px] bg-white-1 shadow-[0px_0px_10px_0px_rgba(0,0,0,0.1)] ${isVisible ? 'reveal-up' : 'opacity-0'} ${extraClass}`}>
            <div className="flex items-center justify-between">
                <img src={icon} alt="" className="w-[48px] h-[48px]" /> {tag ? <span className="text-black-3 text-[0.875rem] font-inter font-semibold leading-[1.25rem] tracking-[0.1%] p-[9.5px_19.5px] rounded-[100px] bg-grey-1">{tag}</span> : null}

            </div>
            <h3 className="text-black-2 text-[1.5rem] font-inter font-semibold leading-[2rem] tracking-normal mt-[24px]">{text}</h3>
            <p className="text-grey-2 text-[1rem] font-inter leading-[1.5rem] tracking-[0.5%]">{subtext}</p>
            <div className="flex flex-wrap gap-[8px] mt-[16px]">
                {features.map((feature, index) => (
                    <span key={index} className="text-black-3 text-[0.875rem] font-inter font-semibold leading-[1.25rem] tracking-[0.1%] p-[9.5px_19.5px] rounded-[100px] bg-grey-1">{feature}</span>
                ))}
            </div>
            <Link to={actionLink} className=" flex items-center text-blue-1 text-[1rem] font-inter p-[8px] mt-[32px] cursor-pointer">
                <span>{actionLabel}</span>
                <ArrowBlueIcon extraClass="ml-[8px]" />
            </Link>
        </div>
    );
};