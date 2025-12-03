import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';

const Header = ({ isAdmin = false }) => {
  return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-primary/10 dark:border-b-primary/20 px-4 sm:px-10 py-3 sticky top-0 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm z-10">
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center rounded-full bg-primary text-white w-8 h-8">
            <span className="material-symbols-outlined text-lg fill-icon">play_arrow</span>
          </div>
          <h1 className="text-xl font-bold text-[#181411] dark:text-gray-100">HoTube</h1>
        </Link>
      </div>

      {!isAdmin && (
        <div className="flex-1 px-4 sm:px-8 max-w-lg">
          <label className="flex flex-col w-full h-10">
            <div className="flex w-full flex-1 items-stretch rounded-full h-full">
              <div className="text-[#8a7560] flex border-none bg-primary/10 dark:bg-primary/20 items-center justify-center pl-4 rounded-l-full border-r-0">
                <span className="material-symbols-outlined text-base">search</span>
              </div>
              <input
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-full text-[#181411] dark:text-gray-200 focus:outline-0 focus:ring-2 focus:ring-primary/50 border-none bg-primary/10 dark:bg-primary/20 h-full placeholder:text-[#8a7560] dark:placeholder:text-gray-400 px-4 rounded-l-none border-l-0 pl-2 text-base font-normal leading-normal"
                placeholder="Search memories..."
              />
            </div>
          </label>
        </div>
      )}

      <div className="flex flex-1 justify-end gap-2 sm:gap-4">
        {!isAdmin && (
          <button className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-10 bg-primary/10 dark:bg-primary/20 text-[#181411] dark:text-gray-200 gap-2 text-base font-bold leading-normal tracking-[0.015em] min-w-0 px-2.5 sm:hidden">
            <span className="material-symbols-outlined text-xl">search</span>
          </button>
        )}
        {isAdmin ? (
          <Link
            to="/"
            className="flex items-center justify-center rounded-full size-10 bg-primary/10 dark:bg-primary/20 text-[#181411] dark:text-gray-200 hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
          >
            <Icon icon="lucide:home" className="text-xl" />
          </Link>
        ) : (
          <Link
            to="/admin"
            className="flex items-center justify-center rounded-full size-10 bg-primary/10 dark:bg-primary/20 text-[#181411] dark:text-gray-200 hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors"
          >
            <Icon icon="lucide:settings" className="text-xl" />
          </Link>
        )}
      </div>
    </header>
  );
};

export default Header;
