import { HiOutlineEnvelope } from "react-icons/hi2";
import { Link } from "react-router-dom";
import { ContentPage, prose, sectionHeading } from "./ContentPage";

const Contact = () => (
  <ContentPage title="Contact Us">
    <p className={prose}>
      Whether you have a question about the data, need help using the platform,
      or want to explore a partnership, the REPSA team is reachable by email. We
      aim to reply within a few working days.
    </p>

    <h2 className={sectionHeading}>General enquiries</h2>
    <p className={prose}>
      For questions about methodology, dataset coverage, citations, or media
      requests, contact the team lead:
    </p>
    <div className="mb-6">
      <p className="text-[0.875rem] font-semibold text-black-1 mb-1">
        Olusola Bamisile, Team Lead
      </p>
      <a
        href="mailto:boomfem@cdut.edu.cn"
        className="inline-flex items-center gap-2 text-[0.875rem] text-blue-1 hover:underline"
      >
        <HiOutlineEnvelope className="size-4 shrink-0" aria-hidden />
        boomfem@cdut.edu.cn
      </a>
    </div>

    <h2 className={sectionHeading}>Technical support</h2>
    <p className={prose}>
      For account issues, bugs, or questions about the web application and API,
      contact the developer:
    </p>
    <div className="mb-6">
      <p className="text-[0.875rem] font-semibold text-black-1 mb-1">
        Daniel O. Olasehinde, App Developer
      </p>
      <a
        href="mailto:dteq@stu.cdut.edu.cn"
        className="inline-flex items-center gap-2 text-[0.875rem] text-blue-1 hover:underline"
      >
        <HiOutlineEnvelope className="size-4 shrink-0" aria-hidden />
        dteq@stu.cdut.edu.cn
      </a>
    </div>

    <h2 className={sectionHeading}>Before you write</h2>
    <p className={prose}>
      Many common questions are answered on the{" "}
      <Link to="/in/faq" className="text-blue-1 hover:underline">
        FAQ
      </Link>{" "}
      and{" "}
      <Link to="/in/help" className="text-blue-1 hover:underline">
        Help Center
      </Link>
      . For data sharing, funding, or code contributions, see{" "}
      <Link to="/in/collaborate" className="text-blue-1 hover:underline">
        Collaborate
      </Link>
      .
    </p>
  </ContentPage>
);

export default Contact;
