# MD Portfolio Builder (Figma 개발용 플러그인)

`docs/01_포트폴리오_페이지별원고.md`(내용)와 `docs/02_디자인_지시문.md`(디자인)를 Figma 파일에 조립한다.
단계마다 메뉴 명령이 하나씩 추가된다.

## 실행 방법 (Figma 데스크톱 앱 필요)
1. 이 폴더(`figma-plugin/`)를 내 컴퓨터에 내려받는다 (`manifest.json`, `code.js`)
2. Figma 데스크톱 앱에서 대상 파일을 연다
3. 메뉴 → Plugins → Development → **Import plugin from manifest…** → `manifest.json` 선택
4. Plugins → Development → **MD Portfolio Builder** → 실행할 단계 선택

## 단계
| 명령 | 만드는 것 |
|---|---|
| 1단계 · 00_스타일·컴포넌트 만들기 | 색 스타일 5, 텍스트 스타일 6, 컴포넌트 7 + 보조 1(Image Placeholder), 스타일 안내판 |
| 2단계 · 마스터: 표지 · 목차 · 01 ABOUT ME | `마스터` 페이지에 공통 프레임 3개(각각 컴포넌트) |

- 글꼴: Pretendard가 설치돼 있으면 Pretendard, 없으면 Noto Sans KR (문서 전체 하나). Pretendard를 쓰려면 실행 전에 PC에 설치하고 Figma를 다시 켠다
- 다시 실행: 색·텍스트 스타일은 같은 이름이면 값만 갱신된다. 컴포넌트는 이미 있으면 만들지 않는다(다른 페이지 인스턴스 연결이 끊기지 않게). 다시 만들려면 `00_스타일·컴포넌트` 페이지 내용을 지운 뒤 실행한다
- 마스터 프레임은 컴포넌트로 만든다. 두 버전 페이지에는 인스턴스로 놓고 버전별 문구·번호만 덮어쓴다. 마스터의 번호는 브랜드 버전(03 있음) 기준
- 마스터 프레임 다시 실행: 버전 페이지에서 아직 쓰이지 않은 프레임만 지우고 다시 만든다
- 실행이 끝나면 여백(좌우 120 / 상하 96) 밖으로 나간 글자 수를 알려 준다. 자세한 목록은 Plugins → Development → Show/Hide console
