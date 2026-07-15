import { Icon } from '@iconify/react';
import { NavLink } from 'react-router-dom';

const navigationItems = [
  { to: '/calendar', label: '캘린더', icon: 'mdi:calendar-month-outline' },
  { to: '/album', label: '앨범', icon: 'mdi:image-multiple-outline' },
  { to: '/upload', label: '업로드', icon: 'mdi:plus', upload: true },
  { to: '/my-album', label: '내 앨범', icon: 'mdi:book-open-page-variant-outline' },
  { to: '/mypage', label: '마이페이지', icon: 'mdi:account-outline' },
];

const getItemClassName = (isActive) => [
  'flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5',
  'text-[11px] font-semibold transition-colors active:scale-95',
  isActive
    ? 'bg-primary/10 text-primary'
    : 'text-text-secondary hover:bg-primary/5 hover:text-primary',
].join(' ');

const BottomNavigation = () => (
  <nav
    aria-label="주요 메뉴"
    className="bottom-navigation fixed inset-x-0 bottom-0 z-sticky border-t border-border bg-surface/95 shadow-[0_-6px_24px_rgb(24_20_17_/_0.08)] backdrop-blur-xl"
  >
    <div className="mx-auto grid max-w-xl grid-cols-5 items-end px-1 pt-1">
      {navigationItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          aria-label={item.label}
          className={({ isActive }) => item.upload
            ? 'group relative -top-5 flex min-w-0 flex-col items-center justify-end gap-1 text-[11px] font-bold text-primary active:scale-95'
            : getItemClassName(isActive)}
        >
          {({ isActive }) => item.upload ? (
            <>
              <span className="flex size-14 items-center justify-center rounded-full border-4 border-surface bg-primary text-white shadow-[0_8px_22px_rgb(244_140_37_/_0.34)] transition-transform group-hover:scale-105">
                <Icon icon={item.icon} className="text-3xl" aria-hidden="true" />
              </span>
              <span>{item.label}</span>
            </>
          ) : (
            <>
              <Icon icon={item.icon} className={`text-2xl ${isActive ? 'stroke-[0.5]' : ''}`} aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  </nav>
);

export default BottomNavigation;
