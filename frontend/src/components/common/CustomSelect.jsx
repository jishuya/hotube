import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@iconify/react';

const CustomSelect = ({
  value = '',
  onChange,
  options = [],
  name,
  required = false,
  disabled = false,
  placeholder = '선택하세요',
  className = '',
  menuClassName = '',
  ...ariaProps
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listboxId = useId();
  const selected = options.find((option) => String(option.value) === String(value));

  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const select = (option) => {
    if (option.disabled) return;
    const nextValue = String(option.value);
    onChange?.({
      target: { name, value: nextValue },
      currentTarget: { name, value: nextValue },
    });
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const enabled = options.filter((option) => !option.disabled);
    if (!enabled.length) return;
    const currentIndex = enabled.findIndex((option) => String(option.value) === String(value));
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = currentIndex < 0
      ? (direction > 0 ? 0 : enabled.length - 1)
      : (currentIndex + direction + enabled.length) % enabled.length;
    select(enabled[nextIndex]);
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-left text-sm transition disabled:cursor-not-allowed disabled:bg-gray-100 ${open ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'} ${className}`}
        {...ariaProps}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? 'text-text-primary' : 'text-text-secondary'}`}>
          {selected?.label ?? placeholder}
        </span>
        <Icon icon={open ? 'mdi:chevron-up' : 'mdi:chevron-down'} className="shrink-0 text-xl text-text-secondary" />
      </button>
      {open && (
        <div
          id={listboxId}
          role="listbox"
          className={`absolute inset-x-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-white p-1 shadow-xl ${menuClassName}`}
        >
          {options.map((option) => {
            const active = String(option.value) === String(value);
            return (
              <button
                key={String(option.value)}
                type="button"
                role="option"
                aria-selected={active}
                disabled={option.disabled}
                onClick={() => select(option)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition disabled:opacity-40 ${active ? 'bg-primary/10 font-bold text-primary' : 'text-text-primary hover:bg-primary/5 hover:text-primary'}`}
              >
                <span className="truncate">{option.label}</span>
                {active && <Icon icon="mdi:check" className="shrink-0 text-lg" />}
              </button>
            );
          })}
        </div>
      )}
      {required && <input tabIndex={-1} aria-hidden="true" className="pointer-events-none absolute h-px w-px opacity-0" name={name} value={value} onChange={() => {}} required />}
    </div>
  );
};

export const DayPickerDropdown = ({ options = [], value, onChange, disabled, 'aria-label': ariaLabel }) => (
  <CustomSelect
    value={value}
    onChange={onChange}
    disabled={disabled}
    aria-label={ariaLabel}
    className="h-9 min-w-24 border-border bg-surface px-2 font-bold"
    menuClassName="max-h-52"
    options={options.map((option) => ({
      value: option.value,
      label: option.label,
      disabled: option.disabled,
    }))}
  />
);

export default CustomSelect;
