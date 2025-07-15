import { ReactNode } from "react";
import { Logo } from "./Icons";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <section>
      <nav className="fixed h-[50px] w-full bg-[#009CD1] flex items-center px-[24px]">
        <Logo />
      </nav>
      <div>{children}</div>
    </section>
  );
};

export default Layout;
