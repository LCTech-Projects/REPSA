import { Link } from "react-router-dom";
import {
  HiOutlineArrowsRightLeft,
  HiOutlineChartBar,
  HiOutlineGlobeAlt,
  HiOutlinePlay,
} from "react-icons/hi2";
import { ContentPage, prose, sectionHeading } from "./ContentPage";

const guides = [
  {
    icon: HiOutlineGlobeAlt,
    title: "Explore the Map",
    path: "/in/map",
    body: "Open the map from the sidebar or footer. Pan and zoom across Africa. Use the layer controls to switch energy poverty indicators and years. Hover a country for a summary card with key metrics. Click through for deeper country detail where available.",
  },
  {
    icon: HiOutlineChartBar,
    title: "Visualization",
    path: "/in/visualization",
    body: "Pick a country and metric, then choose Historical or Realtime mode. Historical supports yearly trends and hourly views. Hourly mode lets you inspect a single day, month, or full year. Use the download button to export CSV or JSON. Sign in when prompted; you will return here with the file ready.",
  },
  {
    icon: HiOutlineArrowsRightLeft,
    title: "Compare Countries",
    path: "/in/compare",
    body: "Select multiple countries and compare indicators side by side in a table and chart. Useful for regional benchmarking and spotting outliers in access or demand.",
  },
  {
    icon: HiOutlinePlay,
    title: "Run Simulation",
    path: "/in/simulation",
    body: "Adjust policy sliders such as access expansion and renewable share, then run the scenario builder. Review projected trajectories for demand and related metrics. Treat outputs as exploratory planning aids.",
  },
] as const;

const Help = () => (
  <ContentPage title="Help Center">
    <p className={prose}>
      REPSA is organised around four main tools plus supporting pages for
      methods and data. This guide walks through each area. New users often start
      on the{" "}
      <Link to="/in/home" className="text-blue-1 hover:underline">
        Home
      </Link>{" "}
      page, then open the map.
    </p>

    <div className="space-y-10 mt-8">
      {guides.map(({ icon: Icon, title, path, body }) => (
        <section key={title}>
          <div className="flex items-start gap-3 mb-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-1/10 text-blue-1">
              <Icon className="size-5" aria-hidden />
            </span>
            <h2 className="text-[1.25rem] font-semibold text-black-1 pt-1.5">
              <Link to={path} className="hover:underline">
                {title}
              </Link>
            </h2>
          </div>
          <p className={`${prose} pl-[52px]`}>{body}</p>
        </section>
      ))}
    </div>

    <h2 className={sectionHeading}>Accounts and downloads</h2>
    <p className={prose}>
      Register with email from{" "}
      <Link to="/sign-up" className="text-blue-1 hover:underline">
        Sign up
      </Link>
      . Verify your address with the code we send. Sign in from the header when
      you need to download data. Password reset flows are under{" "}
      <Link to="/forgot-password" className="text-blue-1 hover:underline">
        Forgot password
      </Link>
      .
    </p>

    <h2 className={sectionHeading}>Learn more</h2>
    <p className={prose}>
      Read{" "}
      <Link to="/in/methodology" className="text-blue-1 hover:underline">
        Methodology
      </Link>{" "}
      for how hourly and yearly series are built,{" "}
      <Link to="/in/data-sources" className="text-blue-1 hover:underline">
        Data Sources
      </Link>{" "}
      for upstream inputs, and{" "}
      <Link to="/in/faq" className="text-blue-1 hover:underline">
        FAQ
      </Link>{" "}
      for quick answers. Developers should see{" "}
      <Link to="/in/api-access" className="text-blue-1 hover:underline">
        API Access
      </Link>
      .
    </p>
  </ContentPage>
);

export default Help;
