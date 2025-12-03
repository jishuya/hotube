import { Icon } from '@iconify/react';

const variants = {
  primary: 'bg-primary text-white hover:bg-primary/90',
  secondary: 'bg-surface text-text-primary border border-border hover:bg-gray-50',
  danger: 'bg-error text-white hover:bg-error/90',
  ghost: 'bg-transparent text-text-primary hover:bg-gray-100',
  outline: 'bg-transparent text-primary border border-primary hover:bg-primary/10',
};

const sizes = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  rounded = 'full', // 'full' | 'lg' | 'md'
  className = '',
  ...props
}) => {
  const isDisabled = disabled || loading;

  const roundedClass = {
    full: 'rounded-full',
    lg: 'rounded-lg',
    md: 'rounded-md',
  }[rounded];

  return (
    <button
      className={`
        inline-flex items-center justify-center font-semibold
        transition-colors duration-fast
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${roundedClass}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <Icon icon="lucide:loader-2" className="animate-spin" />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <Icon icon={icon} className="shrink-0" />
          )}
          {children}
          {icon && iconPosition === 'right' && (
            <Icon icon={icon} className="shrink-0" />
          )}
        </>
      )}
    </button>
  );
};

export default Button;
