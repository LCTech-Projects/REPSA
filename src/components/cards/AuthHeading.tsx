type AuthHeadingProps = {
  title: string;
  description?: string;
};

export const AuthHeading = ({ title, description }: AuthHeadingProps) => (
  <div className="mb-4 text-center w-full">
    <h1
      className={`font-inter font-semibold text-[1.75rem] leading-9 text-auth-heading${description ? " mb-3" : ""}`}
    >
      {title}
    </h1>
    {description && (
      <p className="font-inter font-normal text-base leading-6 tracking-[0.005em] text-black-3">
        {description}
      </p>
    )}
  </div>
);
