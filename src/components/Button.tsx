import React from "react";
import styles from "./Button.module.scss";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = "primary",
  size = "medium",
  disabled = false,
  className = "",
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case "primary":
        return styles.btnPrimary;
      case "secondary":
        return styles.btnSecondary;
      case "outline":
        return styles.btnOutline;
      case "ghost":
        return styles.btnGhost;
      default:
        return styles.btnPrimary;
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case "small":
        return styles.btnSmall;
      case "medium":
        return styles.btnMedium;
      case "large":
        return styles.btnLarge;
      default:
        return styles.btnMedium;
    }
  };

  return (
    <button
      className={`${
        styles.btn
      } ${getVariantClass()} ${getSizeClass()} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;
