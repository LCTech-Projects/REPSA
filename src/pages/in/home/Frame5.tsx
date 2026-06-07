import { ExploreCard } from "../../../components/cards/ExploreCard";
import { explore } from "../../../components/utils/Dummy";
import { useRevealAnimation } from "../../../components/utils/UseRevealAnimation";

export const Frame5 = () => {
    const { ref: headingRef, isVisible: headingVisible } = useRevealAnimation();
    const { ref: textRef, isVisible: textVisible } = useRevealAnimation();

    return (
        <section className="w-full bg-grey-3 pb-[60px] px-[22px] bg-[url('/images/bg3.png')] bg-cover bg-center bg-no-repeat">
            <div className="w-full flex flex-col items-center text-center gap-y-[16px]">
                <h2 ref={headingRef} className={`text-blue-1 text-[2.25rem] font-inter font-semibold leading-11 ${headingVisible ? 'reveal-up' : 'opacity-0'}`}>Explore REPSA</h2>
                <p ref={textRef} className={`text-grey-2 text-[1.375rem] font-inter leading-7 tracking-normal ${textVisible ? 'reveal-up' : 'opacity-0'}`}>
                    Discover our suite of data visualization, mapping and analysis tools to explore energy access data
                </p>
            </div>
            <div className="w-full grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-[20px] mt-[40px]">
                {explore.map((item, index) => (
                    <ExploreCard key={index} {...item} />
                ))}
            </div>
        </section>
    );
};
