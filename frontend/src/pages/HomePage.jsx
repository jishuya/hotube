import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@iconify/react';
import Header from '../components/common/Header';
import VideoCard from '../components/common/VideoCard';
import { getAllVideos } from '../services/videoApi';

const HomePage = () => {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';

  const [videos, setVideos] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // all, shorts, timeline
  const [loading, setLoading] = useState(true);
  const [expandedYears, setExpandedYears] = useState({});

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const fetchedVideos = await getAllVideos();
      setVideos(fetchedVideos);

      // 타임라인 뷰에서 모든 연도를 기본으로 펼침
      const years = [...new Set(fetchedVideos.map(v => v.year))];
      const initialExpanded = {};
      years.forEach(year => {
        initialExpanded[year] = true;
      });
      setExpandedYears(initialExpanded);
    } catch (error) {
      console.error('Error loading videos:', error);
    } finally {
      setLoading(false);
    }
  };

  // 검색 필터링
  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return videos;

    const query = searchQuery.toLowerCase();
    return videos.filter(video =>
      video.title?.toLowerCase().includes(query) ||
      video.tags?.some(tag => tag.toLowerCase().includes(query)) ||
      video.year?.toString().includes(query)
    );
  }, [videos, searchQuery]);

  const regularVideos = filteredVideos.filter(v => v.type === 'video');
  const shorts = filteredVideos.filter(v => v.type === 'shorts');

  // 일반영상 + 쇼츠 인터리브 레이아웃 생성
  // 롱폼 2줄(8개) + 쇼츠 1줄 반복
  // 숏츠 1줄에 들어가는 개수 계산: 롱폼 너비 대비 숏츠 너비 = 9/16
  // 4열 기준 롱폼이 4개면, 같은 공간에 숏츠는 약 7개 (4 / (9/16) ≈ 7.1)
  const interleavedSections = useMemo(() => {
    const sections = [];
    const videosPerSection = 8; // 4 columns x 2 rows
    const shortsPerRow = 7; // 숏츠 1줄에 약 7개

    let videoIndex = 0;
    let shortsIndex = 0;

    while (videoIndex < regularVideos.length || shortsIndex < shorts.length) {
      // 롱폼 섹션 추가 (2줄 = 8개, 부족하면 있는만큼)
      if (videoIndex < regularVideos.length) {
        const count = Math.min(videosPerSection, regularVideos.length - videoIndex);
        sections.push({
          type: 'videos',
          items: regularVideos.slice(videoIndex, videoIndex + count)
        });
        videoIndex += count;
      }

      // 쇼츠 섹션 추가 (1줄, 부족하면 있는만큼)
      if (shortsIndex < shorts.length) {
        const count = Math.min(shortsPerRow, shorts.length - shortsIndex);
        sections.push({
          type: 'shorts',
          items: shorts.slice(shortsIndex, shortsIndex + count)
        });
        shortsIndex += count;
      }
    }

    return sections;
  }, [regularVideos, shorts]);

  // 타임라인 데이터: 연도 > 월별로 그룹핑
  const timelineData = useMemo(() => {
    const grouped = {};

    videos.forEach(video => {
      const year = video.year;
      const date = new Date(video.uploadedAt);
      const month = date.getMonth() + 1; // 1-12

      if (!grouped[year]) {
        grouped[year] = {};
      }
      if (!grouped[year][month]) {
        grouped[year][month] = [];
      }
      grouped[year][month].push(video);
    });

    // 연도 내림차순, 월 내림차순으로 정렬된 배열로 변환
    const sortedYears = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => b - a);

    return sortedYears.map(year => ({
      year,
      months: Object.keys(grouped[year])
        .map(Number)
        .sort((a, b) => b - a)
        .map(month => ({
          month,
          videos: grouped[year][month].sort((a, b) =>
            new Date(b.uploadedAt) - new Date(a.uploadedAt)
          )
        })),
      totalCount: Object.values(grouped[year]).flat().length
    }));
  }, [videos]);

  const toggleYear = (year) => {
    setExpandedYears(prev => ({
      ...prev,
      [year]: !prev[year]
    }));
  };

  const getMonthName = (month) => {
    const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    return months[month - 1];
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <Header />

        <main className="px-4 sm:px-10 py-5">
          <div className="layout-content-container flex flex-col max-w-screen-xl mx-auto flex-1">
            {/* 검색 결과 표시 */}
            {searchQuery && (
              <div className="flex items-center justify-between py-4 px-2 mb-2 bg-primary/5 dark:bg-primary/10 rounded-lg">
                <div className="flex items-center gap-2">
                  <Icon icon="mdi:magnify" className="text-primary text-xl" />
                  <span className="text-[#181411] dark:text-gray-200">
                    "<span className="font-semibold text-primary">{searchQuery}</span>" 검색 결과
                  </span>
                  <span className="text-[#8a7560] dark:text-gray-400">
                    ({filteredVideos.length}개)
                  </span>
                </div>
                <Link
                  to="/"
                  className="flex items-center gap-1 text-sm text-[#8a7560] hover:text-primary transition-colors"
                >
                  <Icon icon="mdi:close" className="text-lg" />
                  초기화
                </Link>
              </div>
            )}

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
                  <p className="text-base font-bold leading-normal tracking-[0.015em]">All Videos</p>
                </button>
                <button
                  onClick={() => setActiveTab('shorts')}
                  className={`flex flex-col items-center justify-center border-b-[3px] ${
                    activeTab === 'shorts'
                      ? 'border-b-primary text-primary'
                      : 'border-b-transparent text-[#8a7560] dark:text-gray-400 hover:text-primary/80'
                  } pb-[13px] pt-4 whitespace-nowrap transition-colors`}
                >
                  <p className="text-base font-bold leading-normal tracking-[0.015em]">Shorts</p>
                </button>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`flex flex-col items-center justify-center border-b-[3px] ${
                    activeTab === 'timeline'
                      ? 'border-b-primary text-primary'
                      : 'border-b-transparent text-[#8a7560] dark:text-gray-400 hover:text-primary/80'
                  } pb-[13px] pt-4 whitespace-nowrap transition-colors`}
                >
                  <p className="text-base font-bold leading-normal tracking-[0.015em]">Timeline</p>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-20">
                <p className="text-[#8a7560] dark:text-gray-400 text-base">Loading videos...</p>
              </div>
            ) : (
              <div className="flex flex-col gap-8 py-6">
                {/* All Videos - 인터리브 레이아웃 (일반영상 3줄 + 쇼츠 1줄 반복) */}
                {activeTab === 'all' && interleavedSections.length > 0 && (
                  <>
                    {interleavedSections.map((section, index) => (
                      <div key={`section-${index}`}>
                        {section.type === 'videos' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
                            {section.items.map((video) => (
                              <VideoCard key={video.id} video={video} />
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2">
                              <Icon icon="mdi:movie-outline" className="text-primary text-2xl" />
                              <h3 className="text-xl font-bold">Shorts</h3>
                            </div>
                            <div className="flex flex-wrap gap-4 justify-start">
                              {section.items.map((video) => (
                                <div key={video.id} className="w-[calc(50%-0.5rem)] sm:w-[calc(25%-0.75rem)] md:w-[calc(20%-0.8rem)] lg:w-[calc((100%-6rem)/7)]">
                                  <VideoCard video={video} isShort={true} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}

                {/* Shorts Only 탭 */}
                {activeTab === 'shorts' && shorts.length > 0 && (
                  <div className="flex flex-wrap gap-4 justify-start">
                    {shorts.map((video) => (
                      <div key={video.id} className="w-[calc(50%-0.5rem)] sm:w-[calc(25%-0.75rem)] md:w-[calc(20%-0.8rem)] lg:w-[calc((100%-6rem)/7)]">
                        <VideoCard video={video} isShort={true} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Timeline View */}
                {activeTab === 'timeline' && (
                  <div className="flex flex-col gap-6">
                    {timelineData.map(({ year, months, totalCount }) => (
                      <div key={year} className="border border-primary/10 dark:border-primary/20 rounded-xl overflow-hidden">
                        {/* Year Header */}
                        <button
                          onClick={() => toggleYear(year)}
                          className="w-full flex items-center justify-between px-4 sm:px-6 py-4 bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Icon icon="mdi:calendar" className="text-primary text-2xl" />
                            <span className="text-xl font-bold">{year}년</span>
                            <span className="text-sm text-[#8a7560] dark:text-gray-400">
                              ({totalCount}개 영상)
                            </span>
                          </div>
                          <Icon
                            icon={expandedYears[year] ? 'mdi:chevron-up' : 'mdi:chevron-down'}
                            className="text-2xl text-[#8a7560]"
                          />
                        </button>

                        {/* Months */}
                        {expandedYears[year] && (
                          <div className="p-4 sm:p-6 flex flex-col gap-6">
                            {months.map(({ month, videos: monthVideos }) => (
                              <div key={month} className="flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-1 h-6 bg-primary rounded-full" />
                                  <h4 className="text-lg font-semibold">{getMonthName(month)}</h4>
                                  <span className="text-sm text-[#8a7560] dark:text-gray-400">
                                    ({monthVideos.length}개)
                                  </span>
                                </div>
                                <div className="flex flex-col gap-4 pl-3">
                                  {/* Regular Videos */}
                                  {monthVideos.filter(v => v.type === 'video').length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                      {monthVideos.filter(v => v.type === 'video').map((video) => (
                                        <VideoCard key={video.id} video={video} />
                                      ))}
                                    </div>
                                  )}
                                  {/* Shorts */}
                                  {monthVideos.filter(v => v.type === 'shorts').length > 0 && (
                                    <div className="flex flex-wrap gap-4 justify-start">
                                      {monthVideos.filter(v => v.type === 'shorts').map((video) => (
                                        <div key={video.id} className="w-[calc(50%-0.5rem)] sm:w-[calc(25%-0.75rem)] md:w-[calc(20%-0.8rem)] lg:w-[calc((100%-6rem)/7)]">
                                          <VideoCard video={video} isShort={true} />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 검색 결과 없음 */}
                {searchQuery && filteredVideos.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Icon icon="mdi:magnify-close" className="text-6xl text-primary/30" />
                    <p className="text-[#181411] dark:text-gray-200 text-xl">
                      "<span className="font-semibold text-primary">{searchQuery}</span>"에 대한 검색 결과가 없습니다
                    </p>
                    <p className="text-[#8a7560] dark:text-gray-400 text-base">
                      다른 검색어를 시도해보세요
                    </p>
                  </div>
                )}

                {/* Empty State */}
                {!searchQuery && videos.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Icon icon="mdi:video-outline" className="text-6xl text-primary/30" />
                    <p className="text-[#8a7560] dark:text-gray-400 text-xl">No videos yet</p>
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
