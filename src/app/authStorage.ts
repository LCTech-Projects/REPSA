const TOKEN_KEY = "repsa_access_token";
const USER_EMAIL_KEY = "repsa_user_email";

export const getAccessToken = () => localStorage.getItem(TOKEN_KEY);

export const setAccessToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearAccessToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export const getUserEmail = () => localStorage.getItem(USER_EMAIL_KEY);

export const setUserEmail = (email: string) => {
  localStorage.setItem(USER_EMAIL_KEY, email);
};

export const clearUserEmail = () => {
  localStorage.removeItem(USER_EMAIL_KEY);
};
