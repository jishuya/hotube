import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';

const Header = ({ isAdmin = false }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');

  // URL의 검색어와 input 동기화
  useEffect(() => {
    const q = searchParams.get('q') || '';
    setSearchQuery(q);
  }, [searchParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/');
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    navigate('/');
  };

  return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-primary/10 dark:border-b-primary/20 px-4 sm:px-10 py-3 sticky top-0 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm z-10">
      <div className="flex items-center gap-4 shrink-0">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="HoTube" className="w-8 h-8" />
          <h1 className="text-xl font-bold text-[#181411] dark:text-gray-100">HoTube</h1>
        </Link>
      </div>

      {!isAdmin && (
        <div className="flex flex-1 justify-center px-2 sm:px-8 min-w-0">
          <form onSubmit={handleSearch} className="flex w-full max-w-2xl h-10">
            <div className="flex w-full flex-1 items-stretch rounded-full h-full relative">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-full text-[#181411] dark:text-gray-200 focus:outline-0 focus:ring-2 focus:ring-primary/50 border-none bg-primary/10 dark:bg-primary/20 h-full placeholder:text-[#8a7560] dark:placeholder:text-gray-400 px-3 sm:px-4 rounded-r-none border-r-0 text-sm sm:text-base font-normal leading-normal pr-8"
                placeholder="Search..."
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-14 top-1/2 -translate-y-1/2 text-[#8a7560] hover:text-primary transition-colors"
                >
                  <Icon icon="mdi:close" className="text-lg" />
                </button>
              )}
              <button
                type="submit"
                className="text-[#8a7560] hover:text-primary flex border-none bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30 items-center justify-center px-3 sm:px-4 rounded-r-full border-l-0 transition-colors"
              >
                <Icon icon="mdi:magnify" className="text-xl" />
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex gap-2 sm:gap-4 shrink-0">
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
