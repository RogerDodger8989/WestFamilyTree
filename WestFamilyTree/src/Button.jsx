import React from 'react';

export default function Button({ 
  children, 
  onClick, 
  variant = 'primary', // 'primary', 'danger', 'secondary', 'success'
  size = 'md', // 'sm', 'md', 'xs'
  className = '', // För att kunna lägga till extra klasser vid behov
  disabled = false,
  ...props // Fångar upp andra props som title, type, etc.
}) {
  
  // 1. Grundläggande stil som alla knappar har (rundade hörn, font, shadow, etc)
  const baseStyle = "rounded font-bold shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";

  // 2. Varianter (Färger)
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700", // Spara, Ny, Koppla
    danger: "bg-red-600 text-white hover:bg-red-700",   // Ta bort
    success: "bg-green-600 text-white hover:bg-green-700", // Bekräfta, Klart
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50", // Avbryt
    ghost: "bg-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-transparent shadow-none" // Enkla textknappar
  };

  // 3. Storlekar
  const sizes = {
    xs: "px-1 py-0.5 text-[10px]", // För dina små AD/RA knappar
    sm: "px-3 py-1 text-sm",       // För knappar i listor/headers
    md: "px-4 py-2 text-sm",       // Standard (Spara i modal)
    lg: "px-6 py-3 text-base"      // Stora knappar
  };

  // Sätt ihop allt
  const finalClass = `
    ${baseStyle} 
    ${variants[variant] || variants.primary} 
    ${sizes[size] || sizes.md} 
    ${className}
  `;

  return (
    <button 
      className={finalClass.trim()} 
      onClick={onClick} 
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}