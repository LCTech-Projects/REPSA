import { HiOutlineEnvelope } from "react-icons/hi2";
import { Footer } from "./home/Footer";

const About = () => {
  return (
    <section className="bg-white-1 min-h-full">
      <div className="px-[22px] py-12 md:py-16">
        <article className="max-w-[800px] mx-auto font-inter text-black-1">
          <h1 className="text-[2rem] md:text-[2.25rem] font-semibold text-blue-1 mb-6">
            About
          </h1>

          <p className="text-[1rem] leading-7 text-grey-2 mb-4">
            REPSA allows you to explore electricity demand, access, and poverty
            indicators across African countries, from continental maps and
            multi country comparisons to hourly and yearly historical views and
            forward looking scenario simulations. We built this platform to make
            research grade energy data and planning tools available to a wider
            community: policymakers, researchers, students, and anyone working to
            close Africa&apos;s energy access gap.
          </p>

          <p className="text-[1rem] leading-7 text-grey-2 mb-4">
            Energy poverty on the continent is driven less by a shortage of
            renewable potential than by uneven grids, limited investment, and gaps
            in planning data. REPSA brings those gaps into view. You can see where
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

          <h2 className="text-[1.25rem] font-semibold text-black-1 mb-4">
            Team
          </h2>
          <p className="text-[1rem] leading-7 text-grey-2 mb-6">
            REPSA is led by researchers and developers working at the intersection
            of energy systems, data science, and African electricity planning.
          </p>

          <div className="space-y-8 mb-10">
            <div>
              <h3 className="text-[1rem] font-semibold text-black-1 mb-1">
                Olusola Bamisile
              </h3>
              <p className="text-[0.875rem] text-grey-2 mb-2">Team Lead</p>
              <p className="text-[1rem] leading-7 text-grey-2">
                Directs the scientific and methodological direction of
                REPSA, including data harmonisation, hourly reconstruction, and
                the scenario tools that underpin the platform.
              </p>
              <a
                href="mailto:boomfem@cdut.edu.cn"
                className="inline-flex items-center gap-2 mt-2 text-[0.875rem] text-blue-1 hover:underline"
              >
                <HiOutlineEnvelope className="size-4 shrink-0" aria-hidden />
                boomfem@cdut.edu.cn
              </a>
            </div>

            <div>
              <h3 className="text-[1rem] font-semibold text-black-1 mb-1">
                Daniel O. Olasehinde
              </h3>
              <p className="text-[0.875rem] text-grey-2 mb-2">App Developer</p>
              <p className="text-[1rem] leading-7 text-grey-2">
                Leads development of the REPSA web application, including the
                maps, dashboards, authentication, and API that deliver the data to
                users.
              </p>
              <a
                href="mailto:dteq@stu.cdut.edu.cn"
                className="inline-flex items-center gap-2 mt-2 text-[0.875rem] text-blue-1 hover:underline"
              >
                <HiOutlineEnvelope className="size-4 shrink-0" aria-hidden />
                dteq@stu.cdut.edu.cn
              </a>
            </div>
          </div>

          <h2 className="text-[1.25rem] font-semibold text-black-1 mb-4">
            Contact
          </h2>
          <p className="text-[1rem] leading-7 text-grey-2 mb-2">
            For general enquiries about REPSA, the dataset, or collaboration
            opportunities, contact the team lead by email:
          </p>
          <a
            href="mailto:boomfem@cdut.edu.cn"
            className="inline-flex items-center gap-2 text-[0.875rem] text-blue-1 hover:underline"
          >
            <HiOutlineEnvelope className="size-4 shrink-0" aria-hidden />
            boomfem@cdut.edu.cn
          </a>

          <h2 className="text-[1.25rem] font-semibold text-black-1 mb-4 mt-10">
            Data use
          </h2>
          <p className="text-[1rem] leading-7 text-grey-2">
            REPSA data and visualisations are intended for research, education,
            and policy analysis. When you use outputs in publications or reports,
            please cite REPSA and refer to the methodology and data sources
            documentation. Registered users may download selected datasets from
            the platform for non commercial analysis. If you are unsure whether
            your use is appropriate, get in touch. We are happy to advise.
          </p>
        </article>
      </div>
      <Footer />
    </section>
  );
};

export default About;
