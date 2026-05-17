import { useState } from "react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { IoEyeOffOutline, IoEyeOutline } from "react-icons/io5";
import type { InputHTMLAttributes } from "react";

type AuthFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  pass?: boolean;
  otp?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "value" | "onChange" | "defaultValue">;

export const AuthField = <T extends FieldValues>({
  control,
  name,
  label,
  pass = false,
  otp = false,
  id,
  className = "",
  type,
  ...props
}: AuthFieldProps<T>) => {
  const [showPassword, setShowPassword] = useState(false);
  const fieldId = id ?? String(name).replace(/\./g, "-");

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <div className="w-full">
          <label
            htmlFor={fieldId}
            className="block font-inter text-sm font-medium text-auth-heading mb-2"
          >
            {label}
          </label>
          <div className="relative w-full">
            <input
              id={fieldId}
              {...field}
              {...props}
              type={pass ? (showPassword ? "text" : "password") : type}
              value={field.value ?? ""}
              onChange={(e) => {
                let value = e.target.value;
                if (otp) {
                  value = value.replace(/\D/g, "").slice(0, 6);
                }
                field.onChange(value);
              }}
              className={`w-full h-[52px] rounded-xl border bg-white-1 font-inter text-base text-auth-heading placeholder:text-grey-2 outline-none transition-colors ${
                pass ? "pr-12 pl-4" : "px-4"
              } py-3 ${
                error ? "border-red-500 focus:border-red-500" : "border-black-4 focus:border-blue-1"
              } ${className}`}
            />
            {pass && (
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-grey-2 hover:text-auth-heading"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <IoEyeOffOutline className="h-5 w-5 shrink-0" aria-hidden />
                ) : (
                  <IoEyeOutline className="h-5 w-5 shrink-0" aria-hidden />
                )}
              </button>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-600 mt-1.5 font-inter">{error.message}</p>
          )}
        </div>
      )}
    />
  );
};
