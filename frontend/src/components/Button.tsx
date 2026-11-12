import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  children,
  className = "",
  ...props
}) => {
  const baseStyles = "w-full py-3 px-4 rounded-lg font-semibold transition-colors duration-200 disabled:opacity-50";
  
  const variants = {
    primary: "bg-[#b94c35] hover:bg-[#d65d3f] text-white",
    secondary: "bg-ayni-softGreen hover:bg-slate-200 text-ayni-green",
    outline: "border border-ayni-green text-ayni-green hover:bg-ayni-lightBg",
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

