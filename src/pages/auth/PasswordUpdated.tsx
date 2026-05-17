import { useNavigate } from "react-router-dom";
import { AuthHeading } from "../../components/cards/AuthHeading";
import { AuthButton } from "../../components/buttons/AuthButton";

const PasswordUpdated = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div
        className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center"
        aria-hidden
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#16a34a"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <AuthHeading
        title="Password Updated"
        description="Your password has been reset successfully. You can now sign in with your new password."
      />

      <AuthButton type="button" onClick={() => navigate("/sign-in")}>
        Go to Sign in
      </AuthButton>
    </div>
  );
};

export default PasswordUpdated;
