import React from 'react';

export default function Button({ 
  children, 
  onClick, 
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  ...props
}) {

  const baseStyle = 'btn-fluent';

  const variants = {
    primary: 'btn-fluent-primary',
    danger: 'btn-fluent-danger',
    success: 'btn-fluent-success',
    secondary: 'btn-fluent-secondary',
    ghost: 'btn-fluent-ghost'
  };

  const sizes = {
    xs: 'h-7 px-2 text-[11px]',
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-5 text-base'
  };

  const finalClass = [
    baseStyle,
    variants[variant] || variants.primary,
    sizes[size] || sizes.md,
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button 
      className={finalClass} 
      onClick={onClick} 
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}