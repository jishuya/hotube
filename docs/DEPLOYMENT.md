# HoTube 실행 및 배포 구성

이 문서는 현재 서버에 실제로 등록된 HoTube 프런트엔드·백엔드 프로세스와 배포 절차를 정리한다.

## 전체 구성

```text
사용자 브라우저
    │
    ▼
Cloudflare Tunnel (hotube.net / www.hotube.net)
    │ localhost:5001
    ▼
Express 백엔드 (PM2: hotube-backend)
    ├── /getVideos 등 백엔드 API
    └── frontend/dist 정적 프런트엔드
            │
            ▼
        React 애플리케이션
```

프런트엔드는 독립적인 운영 프로세스로 실행되지 않는다. Vite로 빌드한 `frontend/dist`를 Express 백엔드가 정적 파일로 제공한다. 따라서 프런트엔드 변경 배포는 빌드가 필요하고, 백엔드 코드 변경 배포는 PM2 재시작이 필요하다.

## 백엔드 프로세스

현재 PM2 등록 정보는 다음과 같다.

| 항목 | 값 |
|---|---|
| PM2 프로세스 이름 | `hotube-backend` |
| 실행 파일 | `backend/src/server.js` |
| 작업 디렉터리 | `backend` |
| 실행 방식 | Node.js, fork mode, 1개 인스턴스 |
| 환경 | `NODE_ENV=production` |
| 포트 | `5001` |
| 파일 감시 | 사용하지 않음 |
| 자동 재시작 | 사용 |
| 메모리 재시작 기준 | 500MB |

PM2 설정 원본은 프로젝트 루트의 `ecosystem.config.cjs`다.

### PM2와 systemd의 관계

PM2 자체는 다음 systemd 서비스로 등록되어 있다.

```text
pm2-jishu.service
```

서버가 부팅되면 이 서비스가 `/home/jishu/.pm2`에 저장된 PM2 프로세스 목록을 복원한다.

HoTube 백엔드만 재시작할 때는 systemd 서비스 전체를 재시작하지 않고 다음 명령을 사용한다. 이 명령은 어느 디렉터리에서 실행해도 된다.

```bash
pm2 restart hotube-backend
```

`sudo systemctl restart pm2-jishu`는 동일 PM2에 등록된 다른 프로젝트도 함께 재시작하므로 일반적인 HoTube 배포에는 사용하지 않는다.

### 상태 및 로그 확인

```bash
pm2 status hotube-backend
pm2 describe hotube-backend
pm2 logs hotube-backend --lines 100
```

HTTP 상태 확인:

```bash
curl http://localhost:5001/health
```

정상 응답 예시:

```json
{"status":"ok","message":"Hotube API 서버 실행 중"}
```

## 프런트엔드

프런트엔드는 React와 Vite로 구성되어 있다. 운영 빌드 결과는 다음 위치에 생성된다.

```text
frontend/dist
```

Express의 `backend/src/app.js`가 이 디렉터리를 정적 파일로 제공하며, React Router 경로는 `dist/index.html`로 전달한다. `sw.js`와 `manifest.webmanifest`는 캐시하지 않도록 별도로 응답한다.

프런트엔드 빌드 명령은 프로젝트 루트에서 다음과 같다.

```bash
cd /home/jishu/workspace/lab/hotube
npm run build
```

또는 프런트엔드 디렉터리에서 직접 실행할 수 있다.

```bash
cd /home/jishu/workspace/lab/hotube/frontend
npm run build
```

프런트엔드는 별도 프로세스가 아니므로 프런트엔드만 수정한 경우 빌드 직후 새 정적 파일이 제공된다. 다만 브라우저나 CDN 캐시 확인을 위해 백엔드 재시작과 강력 새로고침을 함께 수행하는 편이 안전하다.

## Cloudflare Tunnel

외부의 `hotube.net`과 `www.hotube.net` 요청은 다음 systemd 서비스가 로컬 백엔드로 전달한다.

```text
cloudflared-hotube.service → http://localhost:5001
```

설정 파일:

```text
ops/cloudflared-hotube.yml
```

일반적인 코드 배포에서는 Tunnel을 재시작할 필요가 없다. 도메인, Tunnel 설정 또는 로컬 포트를 변경했을 때만 다음 명령을 사용한다.

```bash
sudo systemctl restart cloudflared-hotube
sudo systemctl status cloudflared-hotube --no-pager
```

## 일반 배포 절차

### 프런트엔드와 백엔드를 모두 변경한 경우

```bash
cd /home/jishu/workspace/lab/hotube
npm run build
pm2 restart hotube-backend
pm2 status hotube-backend
curl http://localhost:5001/health
```

이후 브라우저에서 실제 화면과 주요 API 동작을 확인한다.

### 프런트엔드만 변경한 경우

```bash
cd /home/jishu/workspace/lab/hotube
npm run build
```

빌드 후 브라우저에서 강력 새로고침한다. 서비스 워커로 이전 화면이 남으면 사이트를 완전히 닫았다가 다시 열거나 브라우저의 사이트 데이터를 갱신한다.

### 백엔드만 변경한 경우

```bash
pm2 restart hotube-backend
pm2 status hotube-backend
curl http://localhost:5001/health
```

## DB 스키마 변경이 포함된 배포

DB 변경 SQL은 애플리케이션 재시작 전에 적용한다.

```text
1. 적용할 SQL과 대상 DB 확인
2. DB 백업 또는 복구 가능 여부 확인
3. 마이그레이션 SQL 실행
4. 프런트엔드 빌드
5. hotube-backend 재시작
6. health 및 실제 기능 확인
```

마이그레이션은 데이터 변경이나 테이블 삭제를 포함할 수 있으므로 파일 이름만 보고 일괄 실행하지 않는다. 해당 배포에 필요한 SQL만 내용을 확인한 후 실행한다.

## 최초 PM2 등록 또는 프로세스 복구

일반 배포에서는 필요하지 않다. PM2 등록 정보가 사라진 경우에만 프로젝트 루트에서 실행한다.

```bash
cd /home/jishu/workspace/lab/hotube
pm2 start ecosystem.config.cjs
pm2 save
```

`pm2 save`를 실행해야 서버 재부팅 후 `pm2-jishu.service`가 현재 프로세스 목록을 복원할 수 있다.

## 장애 확인 순서

1. `pm2 status hotube-backend`에서 프로세스가 `online`인지 확인한다.
2. `curl http://localhost:5001/health`로 로컬 백엔드를 확인한다.
3. `pm2 logs hotube-backend --lines 100`으로 애플리케이션 오류를 확인한다.
4. 로컬은 정상인데 외부 접속만 실패하면 `systemctl status cloudflared-hotube`를 확인한다.
5. 프런트엔드만 이전 버전이면 `frontend/dist` 빌드 시각과 브라우저·서비스 워커 캐시를 확인한다.


## 미디어 첨부·업로드 성능 확인

파일이 많으면 내용 검사 전에 선택 화면을 먼저 연다. 선택 화면은 기기에서 전달된 순서를 유지하며, 실제 선택한 파일만 중복·촬영일·영상 길이를 검사한다. 중복 제외 후 남은 자리에는 파일을 추가로 선택할 수 있다. 원본 화질은 변경하지 않는다.

전송은 파일 하나 안에서 5MiB 조각을 최대 두 개씩 보낸다. 일시적 오류로 재시도하면 해당 파일의 추가 병렬 작업을 줄인다. 완료 요청은 모든 조각이 승인된 후에만 보내며, 취소·영구 실패 시 진행 중인 요청을 중단한다. 현재 파일 전송 중 다음 파일 하나만 기기에 미리 저장한다.

브라우저 개발자 도구에서 다음 명령으로 최근 단계별 시간을 확인할 수 있다. 단위는 밀리초이며 파일명·해시·사용자 정보는 기록하지 않는다. 각 단계는 최근 최대 100건을 유지한다.

```js
performance.getEntriesByType('measure')
  .filter((entry) => entry.name.startsWith('hotube-upload:'))
  .map(({ name, duration, detail }) => ({ phase: name, ms: Math.round(duration), ...detail }));
```

단계: `duration`(영상 길이), `hash`(내용 검사), `date`(촬영일), `preview`(화면 미리보기), `save`(기기 임시 저장), `init`(업로드 시작), `chunk`(조각 전송·응답), `complete`(서버 최종 처리). 실패한 작업은 `success: false`로 기록된다. 병렬 작업 시간이 겹치므로 각 단계 시간을 합쳐 전체 소요 시간으로 해석하지 않는다.

완료 응답의 `Server-Timing`에는 `assemble`(세션 조회·조각 병합·해시 검증), `finalize`(미디어 등록·사진 파생 이미지 생성 등)가 포함된다. 느린 API 로그에도 같은 구간이 기록된다. `chunk`가 느리면 같은 기기·같은 파일을 내부망과 공개 도메인에서 비교하고, `complete`만 느리면 서버 처리부터 확인한다. 영상의 업로드 후 변환 대기 시간은 이 완료 요청 시간에 포함되지 않는다.


### 업로드 복구와 임시 파일 만료

첨부 목록은 검사 전에 표시하고, 준비된 미리보기부터 갱신한다. 영상 길이 확인은 최대 두 작업으로 제한하며, 취소하면 진행 중 검사가 정리된 뒤 이번에 추가한 항목을 제거한다.

기기 업로드 큐는 IndexedDB 버전 2에서 원본과 크기 요약을 분리한다. 기존 버전은 최초 접근 시 한 번 마이그레이션하며 파일을 보존한다. 재개할 때 요약으로 전체 크기를 계산하고 원본은 전송할 파일 하나씩만 읽는다. 원본 저장과 요약 갱신·삭제는 같은 트랜잭션으로 처리한다.

업로드 세션은 등록할 미디어 ID를 먼저 저장한다. 완료 요청 재시도는 이미 등록된 미디어를 반환하며, 등록 직후 세션 상태 저장이 실패한 경우도 같은 ID로 복구한다. 클라이언트는 일시적인 완료 요청 실패를 최대 세 번까지 시도한다. 재개 초기화는 현재 제목·날짜·태그·공유 범위를 검증해 반영한다.

현재 PM2 구성은 단일 fork 프로세스다. 같은 세션의 초기화·조각 저장·완료·정리는 프로세스 내에서 순서를 보장하며, 다른 세션은 독립적으로 진행한다. 다중 프로세스로 확장할 때는 이 동기화를 공용 잠금으로 교체해야 한다. 조각 임시 파일명은 요청별로 다르게 생성하며 원자적으로 교체한다.

서버 시작과 이후 매시간 최대 100개 세션의 임시 파일을 정리한다. 30일간 갱신되지 않은 미완료 세션은 만료 처리하고, 완료 세션은 하루 지난 잔여 임시 파일만 정리한다. 사용 중인 세션은 건너뛰고 정리 직전에 만료 조건을 재확인한다. 작업 대상은 `.upload-sessions/<세션 ID>`로 한정하며 미디어 원본은 삭제하지 않는다. 정상 정리된 세션은 다시 스캔하지 않도록 표시한다.
