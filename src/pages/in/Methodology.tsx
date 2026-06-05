import { Link } from "react-router-dom";
import { ContentPage, prose, sectionHeading } from "./ContentPage";

const Methodology = () => (
  <ContentPage title="Methodology">
    <p className={prose}>
      REPSA combines harmonised yearly indicators, modelled hourly electricity
      demand, near real time estimates, and a scenario builder so you can move
      from continental overview to country detail and forward looking planning.
      This page summarises how those layers are built and how to interpret them.
    </p>

    <h2 className={sectionHeading}>Yearly historical panel</h2>
    <p className={prose}>
      The core yearly dataset is stored as{" "}
      <code className="text-[0.875rem] bg-grey-1 px-1 rounded">
        yearly_historical_data.csv
      </code>
      . It brings together population, GDP, electricity demand and generation,
      renewable shares, access rates, clean cooking access, and multidimensional
      energy poverty indicators for African countries across multiple decades.
      Values are harmonised to a single country by year schema so maps,
      comparison tables, and charts can query one consistent panel.
    </p>
    <p className={prose}>
      Per capita electricity demand is expressed in megawatt hours for yearly
      views and kilowatt hours per person for hourly exports. Where legacy
      columns remain in source files, the API normalises them before responding.
    </p>

    <h2 className={sectionHeading}>Hourly electricity reconstruction</h2>
    <p className={prose}>
      Measured hourly demand is scarce across Africa. REPSA reconstructs hourly
      profiles for 54 countries by combining yearly totals with reference shapes
      from countries where high resolution data exists. Three anchor profiles
      drive the transfer: South Africa (2024), Nigeria (2016), and Morocco
      (2023). Each country is assigned to the geographically nearest anchor
      using haversine distance between country centroids.
    </p>
    <p className={prose}>
      The assigned shape is scaled so that hourly values integrate to the
      country yearly demand for the selected period. Per capita series adjust
      for population and, where relevant, for the share of the population with
      grid access. Hourly files are stored per country under{" "}
      <code className="text-[0.875rem] bg-grey-1 px-1 rounded">
        api/data/historical/hourly/
      </code>
      . You can explore them in Visualization and download day, month, or full
      year extracts when signed in.
    </p>

    <h2 className={sectionHeading}>Near real time estimates</h2>
    <p className={prose}>
      Realtime indicators project current values from historical trends rather
      than live grid telemetry for every country. The aggregator draws on the
      yearly panel and documented reference sources, then applies statistical
      extrapolation with caching so map and chart views stay responsive. Treat
      these figures as modelled estimates suitable for orientation and
      comparison, not as operational dispatch data.
    </p>

    <h2 className={sectionHeading}>Scenario simulation</h2>
    <p className={prose}>
      The simulation tool uses a trained scenario builder model (
      <code className="text-[0.875rem] bg-grey-1 px-1 rounded">
        scenario_builder.joblib
      </code>
      ) loaded by the API at{" "}
      <code className="text-[0.875rem] bg-grey-1 px-1 rounded">
        /api/story-mode/simulate-scenario
      </code>
      . You adjust policy levers such as access expansion, renewable share, and
      demand growth; the model returns trajectories for electricity demand,
      access, and related metrics. Outputs depend on training data and
      assumptions baked into the model. Use them to explore directions of
      travel, not as forecasts certified for investment decisions.
    </p>

    <h2 className={sectionHeading}>Validation and updates</h2>
    <p className={prose}>
      Maintainer scripts under the local preprocess pipeline regenerate panels,
      retrain models, and produce validation tables. Those scripts are not
      shipped with the public repository, but the resulting CSVs and joblib
      artefacts are what the deployed API serves. When methods change, we update
      this page and the{" "}
      <Link to="/in/data-sources" className="text-blue-1 hover:underline">
        Data Sources
      </Link>{" "}
      documentation together.
    </p>

    <h2 className={sectionHeading}>Citation</h2>
    <p className={prose}>
      When you use REPSA outputs in research or policy work, cite the platform
      and note which layer you used (yearly panel, hourly reconstruction,
      realtime estimate, or scenario simulation). For questions about methods,
      contact the team via the{" "}
      <Link to="/in/contact" className="text-blue-1 hover:underline">
        Contact
      </Link>{" "}
      page.
    </p>
  </ContentPage>
);

export default Methodology;
