import { createBrowserRouter, Navigate } from "react-router-dom";
import Home from "./Pages/in/home";
import InLayout from "./Pages/in/InLayout";
import NotFoundIn from "./Pages/in/NotFound";
import NotFoundAuth from "./Pages/auth/NotFound";
import { Map } from "./Pages/in/Map";
import { Visualization } from "./Pages/in/Visualization";
import { Compare } from "./Pages/in/Compare";
import { Simulation } from "./Pages/in/Simulation";

export const routes = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/in" replace />,
  },
  {
    path: "/in",
    element: <InLayout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "map",
        element: <Map />,
      },
      {
        path: "visualization",
        element: <Visualization />,
      },
      {
        path: "compare",
        element: <Compare />,
      },
      {
        path: "simulation",
        element: <Simulation />,
      },
      {
        path: "*",
        element: <NotFoundIn />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundAuth />,
  },
]);
