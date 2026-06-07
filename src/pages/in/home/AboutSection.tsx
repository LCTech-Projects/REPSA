import { Link } from "react-router-dom";

export const AboutSection = () => (
  <section className="w-full bg-white-1 py-12 md:py-16 px-[22px]">
    <article className="max-w-[800px] mx-auto font-inter text-black-1">
      <h1 className="text-[2rem] md:text-[2.25rem] font-semibold text-blue-1 mb-6">
        About
      </h1>

      <p className="text-[1rem] leading-7 text-grey-2 mb-4">
        REPSA allows you to explore electricity demand, access, and poverty
        indicators across African countries, from continental maps and multi
        country comparisons to hourly and yearly historical views and forward
        looking scenario simulations. We built this platform to make research
        grade energy data and planning tools available to a wider community:
        policymakers, researchers, students, and anyone working to close
        Africa&apos;s energy access gap.
      </p>

      <p className="text-[1rem] leading-7 text-grey-2 mb-4">
        Energy poverty on the continent is driven less by a shortage of renewable
        potential than by uneven grids, limited investment, and gaps in planning
        data. REPSA brings those gaps into view. You can see where
        multidimensional deprivation is concentrated, how per capita demand
        compares across countries, and how access and consumption might evolve
        under different policy assumptions, so diagnosis can lead toward
        actionable solutions.
      </p>

      <p className="text-[1rem] leading-7 text-grey-2 mb-10">
        The platform combines harmonised yearly panels, modelled hourly demand
        shaped by measured reference profiles, and interactive tools for
        visualisation, comparison, and simulation. Our aim is transparency:
        clear methods, documented sources, and outputs you can download for
        further analysis.
      </p>

      <h2 className="text-[1.25rem] font-semibold text-black-1 mb-4">Team</h2>
      <p className="text-[1rem] leading-7 text-grey-2">
        REPSA is developed by researchers from Chengdu University of
        Technology, China, and Imperial College London, UK. These researchers
        work at the intersection of energy systems, data science, and African
        energy planning. For more about REPSA,{" "}
        <Link to="/in/documentation" className="text-blue-1 hover:underline">
          click here
        </Link>
        .
      </p>
    </article>
  </section>
);
