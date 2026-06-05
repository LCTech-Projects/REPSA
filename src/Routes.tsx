import { createBrowserRouter, Navigate } from "react-router-dom";
import Home from "./pages/in/home/Home";
import InLayout from "./pages/in/InLayout";
import NotFoundIn from "./pages/in/NotFound";
import NotFoundAuth from "./pages/auth/NotFound";
import AuthLayout from "./pages/auth/AuthLayout";
import SignIn from "./pages/auth/SignIn";
import ForgotPassword from "./pages/auth/ForgotPassword";
import SignUp from "./pages/auth/SignUp";
import VerifyEmail from "./pages/auth/VerifyEmail";
import ResetPassword from "./pages/auth/ResetPassword";
import PasswordUpdated from "./pages/auth/PasswordUpdated";
import { Map } from "./pages/in/Map";
import { Visualization } from "./pages/in/Visualization";
import { Compare } from "./pages/in/Compare";
import { Simulation } from "./pages/in/Simulation";
import About from "./pages/in/About";
import Collaborate from "./pages/in/Collaborate";
import Methodology from "./pages/in/Methodology";
import DataSources from "./pages/in/DataSources";
import Research from "./pages/in/Research";
import Contact from "./pages/in/Contact";
import FAQ from "./pages/in/FAQ";
import Help from "./pages/in/Help";
import Partners from "./pages/in/Partners";
import Sponsors from "./pages/in/Sponsors";
import Documentation from "./pages/in/Documentation";
import ApiAccess from "./pages/in/ApiAccess";
import { ScrollToTopLayout } from "./components/ScrollToTopLayout";

const contentRedirects = [
  "about",
  "collaborate",
  "methodology",
  "data-sources",
  "research",
  "contact",
  "faq",
  "help",
  "partners",
  "sponsors",
  "documentation",
  "api-access",
] as const;

export const routes = createBrowserRouter([
  {
    element: <ScrollToTopLayout />,
    children: [
  {
    path: "/",
    element: <Navigate to="/in/map" replace />,
  },
  ...contentRedirects.map((segment) => ({
    path: `/${segment}`,
    element: <Navigate to={`/in/${segment}`} replace />,
  })),
  {
    path: "/in",
    element: <InLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="map" replace />,
      },
      {
        path: "home",
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
        path: "about",
        element: <About />,
      },
      {
        path: "collaborate",
        element: <Collaborate />,
      },
      {
        path: "methodology",
        element: <Methodology />,
      },
      {
        path: "data-sources",
        element: <DataSources />,
      },
      {
        path: "research",
        element: <Research />,
      },
      {
        path: "contact",
        element: <Contact />,
      },
      {
        path: "faq",
        element: <FAQ />,
      },
      {
        path: "help",
        element: <Help />,
      },
      {
        path: "partners",
        element: <Partners />,
      },
      {
        path: "sponsors",
        element: <Sponsors />,
      },
      {
        path: "documentation",
        element: <Documentation />,
      },
      {
        path: "api-access",
        element: <ApiAccess />,
      },
      {
        path: "*",
        element: <NotFoundIn />,
      },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: "/sign-in", element: <SignIn /> },
      { path: "/forgot-password", element: <ForgotPassword /> },
      { path: "/sign-up", element: <SignUp /> },
      { path: "/sign-in/password", element: <Navigate to="/sign-in" replace /> },
      { path: "/sign-up/password", element: <Navigate to="/sign-up" replace /> },
      { path: "/verify-email", element: <VerifyEmail /> },
      { path: "/reset-password", element: <ResetPassword /> },
      { path: "/password-updated", element: <PasswordUpdated /> },
    ],
  },
  {
    path: "*",
    element: <NotFoundAuth />,
  },
    ],
  },
]);
