import { Link } from "react-router-dom";
import { HiOutlineArrowRight } from "react-icons/hi2";
import { PillarCard } from "../../../components/cards/PillarCard";
import { pillars } from "../../../components/utils/Dummy";
import { useRevealAnimation } from "../../../components/utils/UseRevealAnimation";

export const Frame2 = () => {
  const { ref: introRef, isVisible: introVisible } =
    useRevealAnimation<HTMLDivElement>();
  const { ref: teamRef, isVisible: teamVisible } =
    useRevealAnimation<HTMLDivElement>();

  return (
    <section className="w-full bg-white-1 py-[60px] px-[22px]">
      <div className="max-w-[1100px] mx-auto">
        <div
          ref={introRef}
          className={`max-w-[720px] mx-auto text-center mb-12 md:mb-16 ${introVisible ? "reveal-up" : "opacity-0"}`}
        >
          <h2 className="text-blue-1 font-libre font-bold leading-tight mb-4" style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)" }}>
            Research grade energy data, ready to use
          </h2>
          <p className="text-grey-2 text-[1rem] md:text-[1.0625rem] font-inter leading-7">
            REPSA turns scattered indicators into one platform for policymakers,
            researchers, and planners working to close Africa&apos;s energy access
            gap. Less hunting for files, more time for decisions.{" "}
            <Link
              to="/in/download-data"
              className="text-blue-1 font-medium hover:underline"
            >
              Click here to explore data
            </Link>
            .
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 md:mb-16">
          {pillars.map(({ icon, title, body }) => (
            <PillarCard key={title} icon={icon} title={title} body={body} />
          ))}
        </div>

        <div
          ref={teamRef}
          className={`rounded-[12px] bg-grey-3 px-6 py-8 md:px-10 md:py-10 text-center ${teamVisible ? "reveal-up" : "opacity-0"}`}
        >
          <h3 className="text-[1.125rem] font-inter font-semibold text-black-1 mb-3">
            Who builds REPSA
          </h3>
          <p className="text-[0.9375rem] md:text-[1rem] font-inter leading-7 text-grey-2 max-w-[640px] mx-auto mb-6">
            REPSA is developed by researchers from Chengdu University of
            Technology, China, and Imperial College London, UK. These researchers
            work at the intersection of energy systems, data science, and African
            energy planning.
          </p>
          <Link
            to="/in/about"
            className="inline-flex items-center gap-2 text-[0.875rem] font-inter font-medium text-blue-1 hover:underline"
          >
            Learn more about REPSA
            <HiOutlineArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
};
