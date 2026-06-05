import { Link } from "react-router-dom";
import { ContentPage, prose, sectionHeading } from "./ContentPage";

const Research = () => (
  <ContentPage title="Research Papers">
    <p className={prose}>
      REPSA is built on ongoing research in energy poverty measurement, hourly
      demand reconstruction, and scenario planning for African electricity
      systems. Peer reviewed publications that describe the methods behind this
      platform will be listed here as they are released.
    </p>

    <h2 className={sectionHeading}>Publications</h2>
    <p className={prose}>
      We currently have two manuscripts under review. One addresses the data
      generation methods behind REPSA, including harmonisation of yearly
      indicators and hourly reconstruction from anchor profiles. The other
      presents the full REPSA software platform: architecture, tools, and how
      the web application delivers the data to users.
    </p>
    <p className={prose}>
      Links to preprints and journal articles will appear here once they are
      published. Contact the team if you need a formal methods description ahead
      of publication.
    </p>

    <h2 className={sectionHeading}>How to cite REPSA today</h2>
    <p className={prose}>
      Until dedicated papers are available, cite the REPSA web platform together
      with the{" "}
      <Link to="/in/methodology" className="text-blue-1 hover:underline">
        Methodology
      </Link>{" "}
      and{" "}
      <Link to="/in/data-sources" className="text-blue-1 hover:underline">
        Data Sources
      </Link>{" "}
      pages for the specific indicators you export. Include the access date and
      the REPSA URL (
      <a
        href="https://repsa.org"
        className="text-blue-1 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        repsa.org
      </a>
      ). For collaboration on academic use, write to{" "}
      <a
        href="mailto:boomfem@cdut.edu.cn"
        className="text-blue-1 hover:underline"
      >
        boomfem@cdut.edu.cn
      </a>
      .
    </p>

    <h2 className={sectionHeading}>Related documentation</h2>
    <p className={prose}>
      End users may prefer the{" "}
      <Link to="/in/documentation" className="text-blue-1 hover:underline">
        Documentation
      </Link>{" "}
      overview and the{" "}
      <Link to="/in/help" className="text-blue-1 hover:underline">
        Help Center
      </Link>{" "}
      for guided tours of each tool.
    </p>
  </ContentPage>
);

export default Research;
