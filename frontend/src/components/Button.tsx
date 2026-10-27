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
  const baseStyles = "w-full py-3 px-4 rounded-2xl font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 shadow-sm";
  
  const variants = {
    primary: "bg-[#0D7A5F] hover:bg-[#0A634D] text-white",
    secondary: "bg-[#E8F5E9] hover:bg-[#D4EDDA] text-[#0D7A5F]",
    outline: "border-2 border-[#0D7A5F] text-[#0D7A5F] hover:bg-[#F4FBF7]",
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

