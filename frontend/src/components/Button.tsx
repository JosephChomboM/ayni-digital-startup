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
  const baseStyles = "w-full py-3 px-4 rounded-2xl font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 shadow-xs";
  
  const variants = {
    primary: "bg-ayni-green hover:bg-ayni-darkGreen text-white",
    secondary: "bg-ayni-softGreen hover:bg-[#D4EDDA] text-ayni-green",
    outline: "border-2 border-ayni-green text-ayni-green hover:bg-ayni-lightBg",
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

