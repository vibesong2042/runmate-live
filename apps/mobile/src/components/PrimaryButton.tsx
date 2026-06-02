import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, variant = "primary", disabled = false }: PrimaryButtonProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, styles[variant], disabled && styles.disabled]}
    >
      <Text style={[styles.label, variant === "secondary" && styles.secondaryLabel, disabled && styles.disabledLabel]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: 18,
  },
  primary: {
    backgroundColor: "#0f766e",
  },
  secondary: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  danger: {
    backgroundColor: "#dc2626",
  },
  disabled: {
    backgroundColor: "#cbd5e1",
    borderColor: "#cbd5e1",
  },
  label: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryLabel: {
    color: "#0f172a",
  },
  disabledLabel: {
    color: "#64748b",
  },
});
