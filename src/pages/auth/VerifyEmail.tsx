import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { AuthHeading } from "../../components/cards/AuthHeading";
import { AuthField } from "../../components/inputs/AuthField";
import { AuthButton } from "../../components/buttons/AuthButton";
import { AuthFooter } from "../../components/cards/AuthFooter";
import { ButtonSpinner } from "../../components/utils/ButtonSpinner";
import {
  verifyEmailSchema,
  type VerifyEmailFormValues,
} from "../../components/utils/Validations";
import { resendVerification, verifyEmail } from "../../app/authApi";
import { useAppSelector } from "../../app/hooks";
import { selectPendingEmail } from "../../app/appSlices/generalSlice";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const email = useAppSelector(selectPendingEmail) ?? "";

  const { control, handleSubmit } = useForm<VerifyEmailFormValues>({
    defaultValues: { code: "" },
    resolver: zodResolver(verifyEmailSchema),
  });

  const onSubmit = async (data: VerifyEmailFormValues) => {
    if (!email) {
      navigate("/sign-up");
      return;
    }

    setApiError(null);
    setLoading(true);
    try {
      await verifyEmail(email, data.code);
      navigate("/sign-in");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email || resendLoading) return;
    setApiError(null);
    setResendLoading(true);
    try {
      await resendVerification(email);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Could not resend code");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full flex flex-col gap-4">
      <AuthHeading
        title="Verify your email"
        description="Enter the 6-digit code we sent to your email address."
      />

      {apiError && (
        <p className="text-sm text-red-600 text-center font-inter">{apiError}</p>
      )}

      <AuthField
        control={control}
        name="code"
        label="Verification code"
        otp
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
      />

      <div className="w-full flex justify-center -mt-1 mb-1 text-center">
        <span className="font-inter text-sm font-medium text-auth-heading">
          Didn&apos;t get the code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading}
            className="text-blue-2 hover:underline font-medium inline-flex items-center justify-center min-w-[5.5rem] disabled:opacity-60"
          >
            {resendLoading ? (
              <ButtonSpinner color="#122354" size={18} />
            ) : (
              "Resend code"
            )}
          </button>
        </span>
      </div>

      <AuthButton type="submit" loading={loading}>
        Verify Code
      </AuthButton>

      <AuthFooter backTo="/sign-in" />
    </form>
  );
};

export default VerifyEmail;
