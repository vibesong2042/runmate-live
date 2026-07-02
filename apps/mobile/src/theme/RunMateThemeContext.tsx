import React, { createContext, useContext } from "react";
import { getRunMateTheme, type RunMateTheme } from "@runmate/shared";

const defaultTheme = getRunMateTheme("classic");
const RunMateThemeContext = createContext<RunMateTheme>(defaultTheme);

export function RunMateThemeProvider({ children, theme }: { children: React.ReactNode; theme: RunMateTheme }) {
  return <RunMateThemeContext.Provider value={theme}>{children}</RunMateThemeContext.Provider>;
}

export function useRunMateTheme(): RunMateTheme {
  return useContext(RunMateThemeContext);
}

export function getDefaultRunMateTheme(): RunMateTheme {
  return defaultTheme;
}
