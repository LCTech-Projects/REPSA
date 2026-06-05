import { useState } from "react";
import { Link } from "react-router-dom";
import Accord from "../../components/Accord";
import { ContentPage, prose, sectionHeading } from "./ContentPage";

const faqs = [
  {
    id: "1",
    q: "Do I need an account to use REPSA?",
    a: "You can explore the map, charts, comparison table, and simulation without signing in. Creating a free account is required to download CSV or JSON exports from Visualization.",
  },
  {
    id: "2",
    q: "Which countries are covered?",
    a: "The map and yearly panel cover African countries in our harmonised dataset. Hourly reconstruction is available for 54 countries. Coverage for individual indicators may differ by year depending on upstream sources.",
  },
  {
    id: "3",
    q: "How current is the data?",
    a: "Yearly indicators follow the latest year available in each source series, with an application year filter limit applied on some views. Realtime counters are modelled estimates extrapolated from history, not live grid feeds for every country.",
  },
  {
    id: "4",
    q: "What do hourly charts represent?",
    a: "Hourly series combine yearly totals with transferred reference shapes from measured anchor countries. They show plausible intraday patterns scaled to national demand, useful for planning and education rather than operational dispatch.",
  },
  {
    id: "5",
    q: "Can I use REPSA data in my report or paper?",
    a: "Yes, for research, education, and policy analysis. Cite REPSA and refer to our Methodology and Data Sources pages. Contact us if your use is commercial or you need a custom licence.",
  },
  {
    id: "6",
    q: "Why did my download ask me to sign in?",
    a: "Exports are gated to registered users so we can manage fair use and stay in touch about major dataset updates. After sign in you return to Visualization and the download completes automatically.",
  },
  {
    id: "8",
    q: "Something looks wrong on the map or chart. What should I do?",
    a: "Note the country, indicator, and year, then email dteq@stu.cdut.edu.cn with a screenshot if possible. Methodology questions go to boomfem@cdut.edu.cn.",
  },
] as const;

const FAQ = () => {
  const [openIds, setOpenIds] = useState<string[]>([]);

  const toggle = (id: string) => {
    setOpenIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  return (
    <ContentPage title="FAQ">
      <p className={prose}>
        Quick answers to common questions about accounts, data coverage,
        downloads, and how to cite REPSA. For step by step guides, visit the{" "}
        <Link to="/in/help" className="text-blue-1 hover:underline">
          Help Center
        </Link>
        .
      </p>

      <div className="w-full mt-8 flex flex-col gap-y-4">
        {faqs.map(({ id, q, a }) => (
          <Accord
            key={id}
            id={id}
            idArray={openIds}
            heading={q}
            text={<p>{a}</p>}
            click={() => toggle(id)}
          />
        ))}
      </div>

      <h2 className={sectionHeading}>Still stuck?</h2>
      <p className={prose}>
        Reach the team on the{" "}
        <Link to="/in/contact" className="text-blue-1 hover:underline">
          Contact
        </Link>{" "}
        page.
      </p>
    </ContentPage>
  );
};

export default FAQ;
