import { useId, useState } from 'react';
import { Icon } from '@iconify/react';
import { DayPicker } from '@daypicker/react';
import { ko } from '@daypicker/react/locale/ko';
import '@daypicker/react/style.css';
import { DayPickerDropdown } from './CustomSelect';

const formatDateKey = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');

const parseDateKey = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const formatDisplayDate = (value) => {
  const date = parseDateKey(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

export const DateRangePicker = ({ from, to, onChange }) => {
  const selected = {
    from: parseDateKey(from),
    to: parseDateKey(to),
  };

  return (
    <DayPicker
      mode="range"
      resetOnSelect
      locale={ko}
      selected={selected.from ? selected : undefined}
      defaultMonth={selected.from || selected.to || new Date()}
      onSelect={(range) => {
        onChange({
          from: range?.from ? formatDateKey(range.from) : '',
          to: range?.to ? formatDateKey(range.to) : '',
        });
      }}
      startMonth={new Date(2000, 0)}
      endMonth={new Date(2035, 11)}
      captionLayout="dropdown"
      components={{ Dropdown: DayPickerDropdown }}
      reverseYears
      showOutsideDays
      className="upload-date-picker"
    />
  );
};

const DatePickerField = ({ label, value, onChange, placeholder = '날짜를 선택하세요' }) => {
  const [open, setOpen] = useState(false);
  const calendarId = useId();
  const selected = parseDateKey(value);

  return (
    <div>
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-11 w-full items-center justify-between rounded-lg border bg-background px-3 text-left text-sm transition ${open ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
        aria-expanded={open}
        aria-controls={calendarId}
      >
        <span className={value ? 'text-text-primary' : 'text-text-secondary'}>
          {formatDisplayDate(value) || placeholder}
        </span>
        <Icon icon="mdi:calendar-month-outline" className="text-xl text-primary" />
      </button>
      {open && (
        <div id={calendarId} className="mt-2 rounded-xl border border-border bg-surface p-2 shadow-sm">
          <DayPicker
            mode="single"
            locale={ko}
            selected={selected}
            defaultMonth={selected || new Date()}
            onSelect={(date) => {
              if (!date) return;
              onChange(formatDateKey(date));
              setOpen(false);
            }}
            startMonth={new Date(2000, 0)}
            endMonth={new Date(2035, 11)}
            captionLayout="dropdown"
            components={{ Dropdown: DayPickerDropdown }}
            reverseYears
            showOutsideDays
            className="upload-date-picker"
          />
        </div>
      )}
    </div>
  );
};

export default DatePickerField;
