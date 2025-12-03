import { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  error,
  helperText,
  className = '',
  ...props
}, ref) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-text-secondary">
          {label}
          {props.required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <input
        ref={ref}
        className={`
          w-full h-10 px-3
          text-sm text-text-primary
          bg-white border border-border rounded-lg
          placeholder:text-text-secondary/60
          focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
          disabled:bg-gray-100 disabled:cursor-not-allowed
          transition-colors duration-fast
          ${error ? 'border-error focus:ring-error/50 focus:border-error' : ''}
          ${className}
        `}
        {...props}
      />
      {(error || helperText) && (
        <p className={`text-xs ${error ? 'text-error' : 'text-text-secondary'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

const Select = forwardRef(({
  label,
  error,
  helperText,
  options = [],
  className = '',
  children,
  ...props
}, ref) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-text-secondary">
          {label}
          {props.required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <select
        ref={ref}
        className={`
          w-full h-10 px-3
          text-sm text-text-primary
          bg-white border border-border rounded-lg
          focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
          disabled:bg-gray-100 disabled:cursor-not-allowed
          transition-colors duration-fast
          ${error ? 'border-error focus:ring-error/50 focus:border-error' : ''}
          ${className}
        `}
        {...props}
      >
        {children || options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {(error || helperText) && (
        <p className={`text-xs ${error ? 'text-error' : 'text-text-secondary'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

const Textarea = forwardRef(({
  label,
  error,
  helperText,
  rows = 3,
  className = '',
  ...props
}, ref) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-text-secondary">
          {label}
          {props.required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        className={`
          w-full px-3 py-2
          text-sm text-text-primary
          bg-white border border-border rounded-lg
          placeholder:text-text-secondary/60
          focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
          disabled:bg-gray-100 disabled:cursor-not-allowed
          resize-none transition-colors duration-fast
          ${error ? 'border-error focus:ring-error/50 focus:border-error' : ''}
          ${className}
        `}
        {...props}
      />
      {(error || helperText) && (
        <p className={`text-xs ${error ? 'text-error' : 'text-text-secondary'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export { Input, Select, Textarea };
export default Input;
