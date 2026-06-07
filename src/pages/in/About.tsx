import { HiOutlineEnvelope } from "react-icons/hi2";
import { AboutSection } from "./home/AboutSection";
import { Footer } from "./home/Footer";

const About = () => {
  return (
    <section className="bg-white-1 min-h-full">
      <AboutSection />

      <div className="px-[22px] pb-12 md:pb-16">
        <article className="max-w-[800px] mx-auto font-inter text-black-1">
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
