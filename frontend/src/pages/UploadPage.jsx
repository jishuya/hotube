import Header from '../components/common/Header';
import PagePlaceholder from '../components/common/PagePlaceholder';

const UploadPage = () => (
  <>
    <Header showSearch={false} />
    <PagePlaceholder
      title="업로드"
      description="사진과 영상을 올리는 페이지를 준비 중입니다."
      icon="mdi:plus"
    />
  </>
);

export default UploadPage;
