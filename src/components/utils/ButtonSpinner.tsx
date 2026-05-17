import { Oval } from "react-loader-spinner";

type ButtonSpinnerProps = {
  color?: string;
  size?: number;
};

export const ButtonSpinner = ({
  color = "#122354",
  size = 24,
}: ButtonSpinnerProps) => (
  <Oval
    height={size}
    width={size}
    color={color}
    secondaryColor={color}
    strokeWidth={4}
    ariaLabel="loading"
  />
);
