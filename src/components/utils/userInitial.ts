export const getEmailInitial = (email: string | null | undefined) => {
  const trimmed = (email ?? "").trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
};
