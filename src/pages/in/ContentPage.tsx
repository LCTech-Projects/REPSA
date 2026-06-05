import type { ReactNode } from "react";
import { Footer } from "./home/Footer";

type ContentPageProps = {
  title: string;
  children: ReactNode;
};

export const ContentPage = ({ title, children }: ContentPageProps) => (
  <section className="bg-white-1 min-h-full">
    <div className="px-[22px] py-12 md:py-16">
      <article className="max-w-[800px] mx-auto font-inter text-black-1">
        <h1 className="text-[2rem] md:text-[2.25rem] font-semibold text-blue-1 mb-6">
          {title}
        </h1>
        {children}
      </article>
    </div>
    <Footer />
  </section>
);

export const prose =
  "text-[1rem] leading-7 text-grey-2 mb-4 last:mb-0";

export const sectionHeading =
  "text-[1.25rem] font-semibold text-black-1 mb-4 mt-10 first:mt-0";
