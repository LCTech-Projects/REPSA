import { Link } from "react-router-dom";
import { ContentPage, prose, sectionHeading } from "./ContentPage";

const Sponsors = () => (
  <ContentPage title="Sponsors">
    <p className={prose}>
      Running a continental data and simulation platform means ongoing costs for
      hosting, storage, email delivery, and researcher time. Sponsorship helps
      REPSA stay online, expand country coverage, and ship features requested by
      the policy and research community.
    </p>

    <h2 className={sectionHeading}>Why sponsor REPSA</h2>
    <p className={prose}>
      Sponsors align their brand with open energy planning in Africa. Support
      can fund new hourly anchor countries, faster API performance, translated
      documentation, or dedicated outreach to planners who need these tools
      most. We recognise sponsors on this page and in release notes where
      appropriate.
    </p>

    <h2 className={sectionHeading}>Sponsorship tiers</h2>
    <p className={prose}>
      We offer flexible arrangements from one off project grants to multi year
      institutional support. Details depend on your goals: visibility,
      co branded research, or targeted feature development. Contact us to discuss
      a package that fits your organisation.
    </p>

    <h2 className={sectionHeading}>Get involved</h2>
    <p className={prose}>
      For funding and sponsorship enquiries, email{" "}
      <a
        href="mailto:boomfem@cdut.edu.cn"
        className="text-blue-1 hover:underline"
      >
        boomfem@cdut.edu.cn
      </a>{" "}
      or read the funding section on{" "}
      <Link to="/in/collaborate" className="text-blue-1 hover:underline">
        Collaborate
      </Link>
      .
    </p>
  </ContentPage>
);

export default Sponsors;
