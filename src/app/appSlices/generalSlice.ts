import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../store";

const EMAIL_KEY = "repsa_auth_email";

type GeneralState = {
  pendingEmail?: string;
};

const initialState: GeneralState = {
  pendingEmail: localStorage.getItem(EMAIL_KEY) ?? undefined,
};

export const generalSlice = createSlice({
  name: "general",
  initialState,
  reducers: {
    setPendingEmail: (state, action: PayloadAction<string>) => {
      state.pendingEmail = action.payload;
      localStorage.setItem(EMAIL_KEY, action.payload);
    },
    clearPendingEmail: (state) => {
      state.pendingEmail = undefined;
      localStorage.removeItem(EMAIL_KEY);
    },
  },
});

export const { setPendingEmail, clearPendingEmail } = generalSlice.actions;

export const selectPendingEmail = (state: RootState) =>
  state.generalReducer.pendingEmail;

export default generalSlice.reducer;
