import type { IconType } from "react-icons";
import { useRevealAnimation } from "../utils/UseRevealAnimation";

type PillarCardProps = {
    icon: IconType;
    title: string;
    body: string;
};

export const PillarCard = ({ icon: Icon, title, body }: PillarCardProps) => {
    const { ref, isVisible } = useRevealAnimation<HTMLDivElement>();

    return (
        <div
            ref={ref}
            className={`flex flex-col gap-4 p-6 md:p-8 rounded-[8px] bg-grey-3 border border-grey-1/80 ${isVisible ? "reveal-up" : "opacity-0"}`}
        >
            <span className="flex size-11 items-center justify-center rounded-lg bg-blue-1/10 text-blue-1">
                <Icon className="size-6" aria-hidden />
            </span>
            <h3 className="text-[1.125rem] font-inter font-semibold text-black-1">
                {title}
            </h3>
            <p className="text-[0.9375rem] font-inter leading-6 text-grey-2">
                {body}
            </p>
        </div>
    );
};
