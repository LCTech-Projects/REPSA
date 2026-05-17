type AuthHeadingProps = {
  title: string;
  description: string;
};

export const AuthHeading = ({ title, description }: AuthHeadingProps) => (
  <div className="mb-8 text-center w-full">
    <h1 className="font-inter font-semibold text-[1.75rem] leading-9 text-auth-heading mb-3">
      {title}
    </h1>
    <p className="font-inter font-normal text-base leading-6 tracking-[0.005em] text-black-3">
      {description}
    </p>
  </div>
);
