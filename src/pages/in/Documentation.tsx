import { Link } from "react-router-dom";
import { ContentPage, prose, sectionHeading } from "./ContentPage";

const sections = [
  {
    title: "Platform overview",
    links: [
      { to: "/in/about", label: "About REPSA" },
      { to: "/in/home", label: "Home and onboarding" },
    ],
  },
  {
    title: "Data and methods",
    links: [
      { to: "/in/methodology", label: "Methodology" },
      { to: "/in/data-sources", label: "Data Sources" },
      { to: "/in/research", label: "Research Papers" },
    ],
  },
  {
    title: "Using the tools",
    links: [
      { to: "/in/help", label: "Help Center" },
      { to: "/in/faq", label: "FAQ" },
      { to: "/in/map", label: "Explore Map" },
      { to: "/in/visualization", label: "Visualization" },
      { to: "/in/compare", label: "Compare Countries" },
      { to: "/in/simulation", label: "Run Simulation" },
    ],
  },
  {
    title: "For developers",
    links: [
      { to: "/in/api-access", label: "API Access" },
    ],
  },
  {
    title: "Community",
    links: [
      { to: "/in/collaborate", label: "Collaborate" },
      { to: "/in/partners", label: "Our Partners" },
      { to: "/in/contact", label: "Contact Us" },
    ],
  },
] as const;

const Documentation = () => (
  <ContentPage title="Documentation">
    <p className={prose}>
      This page indexes the main documentation for REPSA. Use it as a starting
      point whether you are exploring data as a policymaker, citing indicators in
      a paper, or integrating the API into your own workflow.
    </p>

    <div className="space-y-8 mt-8">
      {sections.map(({ title, links }) => (
        <section key={title}>
          <h2 className="text-[1.25rem] font-semibold text-black-1 mb-3">
            {title}
          </h2>
          <ul className="space-y-2">
            {links.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="text-[0.875rem] text-blue-1 hover:underline"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>

    <h2 className={sectionHeading}>Source code</h2>
    <p className={prose}>
      The application source lives in the public REPSA repository. It includes
      the React frontend, Flask API, bundled CSV datasets, and the scenario
      builder model. Maintainer only preprocess scripts are not published but
      runtime data artefacts ship with the repo for deployment.
    </p>
  </ContentPage>
);

export default Documentation;
