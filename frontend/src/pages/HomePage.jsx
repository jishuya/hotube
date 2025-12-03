import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/common/Header';
import VideoCard from '../components/common/VideoCard';
import { getAllVideos } from '../services/videoApi';

const HomePage = () => {
  const [videos, setVideos] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // all, shorts, year
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const fetchedVideos = await getAllVideos();
      setVideos(fetchedVideos);
    } catch (error) {
      console.error('Error loading videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const regularVideos = videos.filter(v => v.type === 'video');
  const shorts = videos.filter(v => v.type === 'shorts');

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <Header />

        <main className="px-4 sm:px-10 py-5">
          <div className="layout-content-container flex flex-col max-w-screen-xl mx-auto flex-1">
            {/* Tabs */}
            <div className="pb-3">
              <div className="flex border-b border-primary/10 dark:border-primary/20 sm:px-4 gap-4 sm:gap-8 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`flex flex-col items-center justify-center border-b-[3px] ${
                    activeTab === 'all'
                      ? 'border-b-primary text-primary'
                      : 'border-b-transparent text-[#8a7560] dark:text-gray-400 hover:text-primary/80'
                  } pb-[13px] pt-4 whitespace-nowrap transition-colors`}
                >
                  <p className="text-sm font-bold leading-normal tracking-[0.015em]">All Videos</p>
                </button>
                <button
                  onClick={() => setActiveTab('shorts')}
                  className={`flex flex-col items-center justify-center border-b-[3px] ${
                    activeTab === 'shorts'
                      ? 'border-b-primary text-primary'
                      : 'border-b-transparent text-[#8a7560] dark:text-gray-400 hover:text-primary/80'
                  } pb-[13px] pt-4 whitespace-nowrap transition-colors`}
                >
                  <p className="text-sm font-bold leading-normal tracking-[0.015em]">Family Shorts</p>
                </button>
                <button
                  onClick={() => setActiveTab('year')}
                  className={`flex flex-col items-center justify-center border-b-[3px] ${
                    activeTab === 'year'
                      ? 'border-b-primary text-primary'
                      : 'border-b-transparent text-[#8a7560] dark:text-gray-400 hover:text-primary/80'
                  } pb-[13px] pt-4 whitespace-nowrap transition-colors`}
                >
                  <p className="text-sm font-bold leading-normal tracking-[0.015em]">Filter by Year</p>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-20">
                <p className="text-[#8a7560] dark:text-gray-400">Loading videos...</p>
              </div>
            ) : (
              <div className="flex flex-col gap-8 py-6">
                {/* Regular Videos Grid */}
                {(activeTab === 'all' || activeTab === 'year') && regularVideos.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                    {regularVideos.map((video) => (
                      <VideoCard key={video.id} video={video} />
                    ))}
                  </div>
                )}

                {/* Shorts Section */}
                {(activeTab === 'all' || activeTab === 'shorts') && shorts.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-2xl">movie</span>
                      <h3 className="text-xl font-bold">Family Shorts</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {shorts.map((video) => (
                        <VideoCard key={video.id} video={video} isShort={true} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {videos.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <span className="material-symbols-outlined text-6xl text-primary/30">video_library</span>
                    <p className="text-[#8a7560] dark:text-gray-400 text-lg">No videos yet</p>
                    <Link
                      to="/admin"
                      className="px-6 py-2 bg-primary text-white rounded-full font-semibold hover:bg-primary/90 transition-colors"
                    >
                      Add your first video
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default HomePage;
