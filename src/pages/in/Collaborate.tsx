import {
  HiOutlineClock,
  HiOutlineCodeBracket,
  HiOutlineCurrencyDollar,
  HiOutlineEnvelope,
} from "react-icons/hi2";
import { Link } from "react-router-dom";
import { Footer } from "./home/Footer";

const ways = [
  {
    icon: HiOutlineClock,
    title: "Hourly electricity data",
    body: "We are looking for partners who can share measured hourly electricity demand, or closely related system data, for African countries. Real reference profiles strengthen our reconstruction method and improve accuracy for neighbouring countries assigned to the same anchor shape. If you hold operational data, national statistics, or research datasets with hourly resolution, we would like to hear from you.",
  },
  {
    icon: HiOutlineCodeBracket,
    title: "Contribute to the codebase",
    body: "REPSA is an evolving open platform. Developers, data engineers, and designers can contribute bug fixes, new visualisations, API improvements, documentation, and validation tools. Whether you work on the React frontend, the Flask API, or offline data pipelines, there is room to help, especially if you care about energy access and reproducible data products.",
  },
  {
    icon: HiOutlineCurrencyDollar,
    title: "Funding and sponsorship",
    body: "Sustaining continental scale data products requires compute, storage, domain services, and researcher time. We welcome grants, institutional support, and sponsorship from organisations aligned with transparent energy planning in Africa. Funding can accelerate new countries, higher resolution data, and features requested by the policy community.",
  },
] as const;

const Collaborate = () => {
  return (
    <section className="bg-white-1 min-h-full">
      <div className="px-[22px] py-12 md:py-16">
        <article className="max-w-[800px] mx-auto font-inter text-black-1">
          <h1 className="text-[2rem] md:text-[2.25rem] font-semibold text-blue-1 mb-6">
            Collaborate
          </h1>

          <p className="text-[1rem] leading-7 text-grey-2 mb-4">
            REPSA grows when people share data, code, and resources. We built the
            platform to be useful beyond our own research group, and we depend on
            collaborators who can extend coverage, improve methods, and keep the
            service running for planners and analysts across Africa.
          </p>

          <p className="text-[1rem] leading-7 text-grey-2 mb-10">
            If any of the areas below match your work, please reach out. Tell us
            what you can offer, which countries or systems you know, and how you
            would like to be involved. We will respond as soon as we can.
          </p>

          <div className="space-y-10 mb-12">
            {ways.map(({ icon: Icon, title, body }) => (
              <section key={title}>
                <div className="flex items-start gap-3 mb-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-1/10 text-blue-1">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h2 className="text-[1.25rem] font-semibold text-black-1 pt-1.5">
                    {title}
                  </h2>
                </div>
                <p className="text-[1rem] leading-7 text-grey-2 pl-[52px]">
                  {body}
                </p>
              </section>
            ))}
          </div>

          <h2 className="text-[1.25rem] font-semibold text-black-1 mb-4">
            Get in touch
          </h2>
          <p className="text-[1rem] leading-7 text-grey-2 mb-4">
            For data partnerships, development contributions, or funding
            discussions, contact:
          </p>

          <ul className="space-y-4 mb-6">
            <li>
              <p className="text-[0.875rem] font-semibold text-black-1">
                Olusola Bamisile, Team Lead
              </p>
              <a
                href="mailto:boomfem@cdut.edu.cn"
                className="inline-flex items-center gap-2 text-[0.875rem] text-blue-1 hover:underline"
              >
                <HiOutlineEnvelope className="size-4 shrink-0" aria-hidden />
                boomfem@cdut.edu.cn
              </a>
            </li>
            <li>
              <p className="text-[0.875rem] font-semibold text-black-1">
                Daniel O. Olasehinde, App Developer
              </p>
              <a
                href="mailto:dteq@stu.cdut.edu.cn"
                className="inline-flex items-center gap-2 text-[0.875rem] text-blue-1 hover:underline"
              >
                <HiOutlineEnvelope className="size-4 shrink-0" aria-hidden />
                dteq@stu.cdut.edu.cn
              </a>
            </li>
          </ul>

          <p className="text-[0.875rem] leading-6 text-grey-2">
            You can also read more about the project on the{" "}
            <Link to="/in/about" className="text-blue-1 hover:underline">
              About
            </Link>{" "}
            page.
          </p>
        </article>
      </div>
      <Footer />
    </section>
  );
};

export default Collaborate;
