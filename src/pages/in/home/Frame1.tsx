import { useNavigate } from "react-router-dom";
import { useRevealAnimation } from "../../../components/utils/UseRevealAnimation";

export const Frame1 = () => {
    const { ref: textRef, isVisible: textVisible } = useRevealAnimation<HTMLDivElement>();
    const { ref: imageRef, isVisible: imageVisible } = useRevealAnimation<HTMLImageElement>();
    const navigate = useNavigate();

    return (
        <section className="w-full py-[60px] px-[22px] flex flex-col md:flex-row gap-[20px] bg-[url('/images/bg1.png')] bg-cover bg-center bg-no-repeat">
            <div ref={textRef} className={`w-full md:w-1/2 ${textVisible ? 'reveal-up' : 'opacity-0'}`}>
                <h2 className="text-blue-1 text-[2.25rem] lg:text-[3rem] font-semibold leading-11 lg:leading-15 tracking-tight">What is Energy Poverty?</h2>
                <p className="text-grey-2 text-[1rem] text-justify font-inter leading-6 tracking-[0.5%] mt-[12px] max-w-[586px]">
                    Energy poverty is the condition in which people cannot obtain enough modern energy services to meet basic needs and support dignified living. It includes living without grid electricity, cooking with harmful solid fuels, paying a large share of income for poor quality supply, and using so little power that lighting, appliances, and livelihoods remain out of reach. It is therefore not a single problem, but a set of linked deficits in access, affordability, reliability, and consumption.
                </p>
                <p className="text-grey-2 text-[1rem] text-justify font-inter leading-6 tracking-[0.5%] mt-[16px] max-w-[586px]">
                    Africa illustrates the scale most clearly. More than 600 million people there lack electricity, and about 730 million rely on traditional biomass for cooking. Many who are connected still fall below levels associated with modern use. Uneven progress on power lines versus clean stoves shows that energy poverty can persist even where electrification rates rise.
                </p>
                <p className="text-grey-2 text-[1rem] text-justify font-inter leading-6 tracking-[0.5%] mt-[16px] max-w-[586px]">
                    Energy poverty is driven less by a shortage of sun or wind than by underinvestment, weak grids, and limited planning data. Reducing it requires targeting who lacks access, how much they actually consume, and what policies can close the gap. Tools such as REPSA help map deprivation, model demand, and compare countries so planners can move from diagnosis toward solutions.
                </p>

                <button onClick={() => navigate('/in/map')} className="bg-yellow-1 text-blue-1 text-[0.875rem] font-medium font-inter p-[8px] rounded-[8px] h-[64px] w-[205px] mt-[32px] cursor-pointer hover:shadow-lg transition-shadow">Explore REPSA</button>
            </div>
            <img ref={imageRef} src="/images/block1Hero.png" alt="" className={`w-full md:w-1/2 ${imageVisible ? 'reveal-up' : 'opacity-0'}`} />
        </section>
    );
};