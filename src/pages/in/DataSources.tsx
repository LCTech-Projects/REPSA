import { Link } from "react-router-dom";
import { ContentPage, prose, sectionHeading } from "./ContentPage";

const references = [
  {
    id: "wdi",
    citation: (
      <>
        World Bank, &ldquo;World Development Indicators | DataBank,&rdquo;{" "}
        <em>World Development Indicators</em>. Accessed: Mar. 09, 2026. [Online].
        Available:{" "}
        <a
          href="https://databank.worldbank.org/source/world-development-indicators/Type/TABLE/preview/on"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-1 hover:underline break-all"
        >
          https://databank.worldbank.org/source/world-development-indicators/Type/TABLE/preview/on
        </a>
      </>
    ),
    use: "Population, GDP, electricity access, clean cooking access, and related development indicators in the yearly panel and realtime extrapolation.",
  },
  {
    id: "owid",
    citation: (
      <>
        Our World in Data, &ldquo;owid/energy-data: Data on energy by Our World
        in Data,&rdquo; OWID. Accessed: Mar. 09, 2026. [Online]. Available:{" "}
        <a
          href="https://github.com/owid/energy-data"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-1 hover:underline break-all"
        >
          https://github.com/owid/energy-data
        </a>
      </>
    ),
    use: "Historical electricity generation, renewable shares, emissions intensity, and harmonised energy statistics in the yearly dataset.",
  },
  {
    id: "eskom",
    citation: (
      <>
        ESKOM, &ldquo;Eskom Data Portal,&rdquo; ESKOM. Accessed: Mar. 09, 2026.
        [Online]. Available:{" "}
        <a
          href="https://www.eskom.co.za/dataportal/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-1 hover:underline"
        >
          https://www.eskom.co.za/dataportal/
        </a>
      </>
    ),
    use: "Measured hourly electricity demand for South Africa, used as the 2024 anchor profile for hourly reconstruction.",
  },
  {
    id: "nigeria",
    citation: (
      <>
        O. Oluwole, &ldquo;Nigeria National Demand Timeseries [2016],&rdquo; vol.
        1, 2022, doi:{" "}
        <a
          href="https://doi.org/10.17632/PXVDM26RN7.1"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-1 hover:underline"
        >
          10.17632/PXVDM26RN7.1
        </a>
        .
      </>
    ),
    use: "Reference hourly demand shape for Nigeria, used as the 2016 anchor profile assigned to neighbouring countries by geographic proximity.",
  },
  {
    id: "morocco",
    citation: (
      <>
        M. Bensalah, A. Hair, R. Rabie, and H. Derrouz,
        &ldquo;High-resolution smart meter load dataset collected from multiple
        cities in Morocco,&rdquo; <em>Data Brief</em>, vol. 62, Oct. 2025, doi:{" "}
        <a
          href="https://doi.org/10.1016/j.dib.2025.112067"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-1 hover:underline"
        >
          10.1016/j.dib.2025.112067
        </a>
        .
      </>
    ),
    use: "High resolution smart meter load data for Morocco, used as the 2023 anchor profile for hourly reconstruction in North and West Africa.",
  },
] as const;

const DataSources = () => (
  <ContentPage title="Data Sources">
    <p className={prose}>
      REPSA harmonises open and published datasets, applies documented
      transformations, and fills gaps with modelled series where measurement is
      incomplete. The references below are the primary upstream sources. For
      processing steps, see{" "}
      <Link to="/in/methodology" className="text-blue-1 hover:underline">
        Methodology
      </Link>
      .
    </p>

    <h2 className={sectionHeading}>References</h2>
    <ol className="space-y-8 mb-4 list-decimal list-outside pl-5 marker:text-black-1 marker:font-semibold">
      {references.map(({ id, citation, use }) => (
        <li key={id} className="pl-1">
          <p className="text-[0.9375rem] leading-7 text-grey-2 mb-2">
            {citation}
          </p>
          <p className={`${prose} text-[0.875rem] italic`}>{use}</p>
        </li>
      ))}
    </ol>

    <h2 className={sectionHeading}>Derived products on the platform</h2>
    <p className={prose}>
      The yearly panel (
      <code className="text-[0.875rem] bg-grey-1 px-1 rounded">
        yearly_historical_data.csv
      </code>
      ) is the backbone for maps, Compare, and yearly Visualization modes.
      Hourly country files under{" "}
      <code className="text-[0.875rem] bg-grey-1 px-1 rounded">
        api/data/historical/hourly/
      </code>{" "}
      combine yearly totals from the references above with transferred anchor
      shapes from ESKOM, Nigeria, and Morocco. The scenario builder model is
      trained offline from the same harmonised history.
    </p>

    <h2 className={sectionHeading}>Coverage and limitations</h2>
    <p className={prose}>
      Coverage varies by country and indicator. Some series stop before the
      latest calendar year because upstream sources have not published updates.
      Hourly reconstruction inherits uncertainty from anchor choice and from
      yearly totals. Realtime counters are extrapolations, not live metering.
      Always check the year filter on charts and read the methodology notes
      before citing a number in a formal report.
    </p>

    <h2 className={sectionHeading}>Contributing data</h2>
    <p className={prose}>
      If you maintain official statistics or research datasets that could
      improve REPSA, especially measured hourly demand for African countries,
      please reach out through{" "}
      <Link to="/in/collaborate" className="text-blue-1 hover:underline">
        Collaborate
      </Link>
      . We prioritise transparent licensing and clear documentation of
      collection methods.
    </p>
  </ContentPage>
);

export default DataSources;
