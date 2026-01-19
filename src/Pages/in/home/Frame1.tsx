import { useNavigate } from "react-router-dom";
import { useRevealAnimation } from "../../../hooks/useRevealAnimation";

export const Frame1 = () => {
    const { ref: textRef, isVisible: textVisible } = useRevealAnimation<HTMLDivElement>();
    const { ref: imageRef, isVisible: imageVisible } = useRevealAnimation<HTMLImageElement>();
    const navigate = useNavigate();

    return (
        <section className="w-full py-[60px] px-[22px] flex flex-col md:flex-row gap-[20px] bg-[url('/images/bg1.png')] bg-cover bg-center bg-no-repeat">
            <div ref={textRef} className={`w-full md:w-1/2 ${textVisible ? 'reveal-up' : 'opacity-0'}`}>
                <h2 className="text-blue-1 text-[2.25rem] lg:text-[3rem] font-semibold leading-11 lg:leading-15 tracking-tight">What is Energy Poverty?</h2>
                <p className="text-grey-2 text-[1rem] font-inter leading-6 tracking-[0.5%] mt-[12px] max-w-[586px]">Energy poverty occurs when communities lack access to modern and clean energy solutions, relying on traditional and often harmful energy sources instead. This issue affects billions around the world particularly in Sub-Sahara Africa, impacting health, education, and economics opportunities. The solution, a systematic investment strategy to create a cleaner, and more equitable energy futures.</p>
                <button onClick={() => navigate('/in/map')} className="bg-yellow-1 text-blue-1 text-[0.875rem] font-medium font-inter p-[8px] rounded-[8px] h-[64px] w-[205px] mt-[32px] cursor-pointer hover:shadow-lg transition-shadow">Explore REPSA</button>
            </div>
            <img ref={imageRef} src="/images/block1Hero.png" alt="" className={`w-full md:w-1/2 ${imageVisible ? 'reveal-up' : 'opacity-0'}`} />
        </section>
    );
};