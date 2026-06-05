import { Link } from "react-router-dom";
import { ContentPage, prose, sectionHeading } from "./ContentPage";

const Partners = () => (
  <ContentPage title="Our Partners">
    <p className={prose}>
      REPSA is designed as a shared resource for African energy planning. We
      work with universities, grid operators, NGOs, and government agencies that
      care about transparent data and open tools. Partner logos and formal
      acknowledgements will appear here as collaborations are announced.
    </p>

    <h2 className={sectionHeading}>What partnership can look like</h2>
    <p className={prose}>
      Partners may contribute measured hourly or yearly data, host validation
      workshops, co author methods papers, or integrate REPSA outputs into
      national planning workflows. Some partners provide in kind technical
      review; others support infrastructure or researcher time.
    </p>

    <h2 className={sectionHeading}>Become a partner</h2>
    <p className={prose}>
      If your organisation wants to extend country coverage, improve anchor
      profiles, or embed REPSA in a programme of work, start a conversation on
      the{" "}
      <Link to="/in/collaborate" className="text-blue-1 hover:underline">
        Collaborate
      </Link>{" "}
      page or email{" "}
      <a
        href="mailto:boomfem@cdut.edu.cn"
        className="text-blue-1 hover:underline"
      >
        boomfem@cdut.edu.cn
      </a>
      . Tell us your country focus, the data or expertise you can offer, and how
      you would like to be credited.
    </p>

    <h2 className={sectionHeading}>About the project</h2>
    <p className={prose}>
      Learn more about the team and mission on{" "}
      <Link to="/in/about" className="text-blue-1 hover:underline">
        About REPSA
      </Link>
      .
    </p>
  </ContentPage>
);

export default Partners;
