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
      renewable shares, access rates, clean cooking access, and access-based
      energy poverty indicators for African countries. Values are harmonised to
      a single country-by-year schema so maps, comparison tables, and charts can
      query one consistent panel.
    </p>
    <p className={prose}>
      Energy poverty indicators in REPSA are national aggregates derived from
      access statistics, not household-survey multidimensional poverty indices
      such as MEPI. <strong>Electricity poverty</strong> is{" "}
      <code className="text-[0.875rem] bg-grey-1 px-1 rounded">
        100 − electricity access (%)
      </code>
      . The <strong>access-based multidimensional indicator</strong> is the
      average of electricity deprivation and clean-cooking deprivation:{" "}
      <code className="text-[0.875rem] bg-grey-1 px-1 rounded">
        [(100 − electricity access) + (100 − clean cooking access)] / 2
      </code>
      . Rural and urban electricity poverty use the same one-minus-access rule
      on rural and urban access rates. These national rates do not resolve
      within-country inequality.
    </p>
    <p className={prose}>
      Per capita electricity demand is expressed in megawatt hours per person
      for yearly views and kilowatt hours per person for hourly exports. Where
      legacy columns remain in source files, the API normalises them before
      responding.
    </p>

    <h2 className={sectionHeading}>Hourly electricity reconstruction</h2>
    <p className={prose}>
      Measured hourly demand is scarce across Africa. REPSA reconstructs hourly
      profiles for 54 countries by combining yearly totals with reference shapes
      from countries where high resolution data exists. Three anchor profiles
      drive the transfer: South Africa (2024), Nigeria (2016), and Algeria
      (2019). Each country is assigned using electricity access, demand per
      capita, income, urbanization, and (where available) industry versus
      household electricity shares, with a small geographic weight. Cooling
      and heating degree days are used only for high-access or high-consumption
      systems, where thermal comfort can actually draw power. Low-access
      countries are not treated as climate-driven. The Nigeria 2016 shape is
      suppressed demand: countries with high access or high per capita
      consumption cannot inherit it.
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
      than live grid telemetry. Absolute metrics use log-linear growth with
      year-by-year dampening (δ = 1.0 for 1–2 years ahead, 0.7 for 3–5, 0.4
      thereafter). Access uses a logit-linear logistic projection; other
      percentages use bounded linear projection. Reported uncertainty margins
      are heuristic (5% base + 3% per projection year, scaled by fit quality),
      not formal confidence intervals. Treat these figures as modelled
      estimates for orientation and comparison, not as operational dispatch
      data.
    </p>

    <h2 className={sectionHeading}>Scenario Simulation</h2>
    <p className={prose}>
      The scenario explorer uses a Random Forest growth-panel model trained on
      the yearly panel. Features include country, year, population, GDP, access
      rates, renewable share, current target levels, and lagged growth rates.
      Policy targets for access, clean cooking, and renewables cannot be set
      below the country&apos;s latest observed values. Uncertainty bands are
      empirical residual quantiles (nominally 80% coverage from walk-forward
      residuals), not tree-dispersion intervals. Random Forests do not
      extrapolate beyond the training range, so long-horizon scenarios to 2050
      should be treated as exploratory. Walk-forward metrics versus persistence
      and historical-growth baselines are returned with each simulation
      response. See{" "}
      <code className="text-[0.875rem] bg-grey-1 px-1 rounded">
        /api/scenario-simulation/simulate-scenario
      </code>{" "}
      and{" "}
      <code className="text-[0.875rem] bg-grey-1 px-1 rounded">
        scenario_builder.joblib
      </code>
      .
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
