# honam-games

쉬는 시간에 학생들이 즐기는 웹 게임 모음입니다. Cloudflare Pages에 연결해 자동 배포합니다.

| 폴더 | 게임 | 랭킹 (Firebase Firestore 컬렉션) |
|---|---|---|
| `tetris/` | 냥냥 테트리스 | `tetris-scores` |
| `spelling/` | 꼬비의 한글 맞춤법 대소동 | `spelling-scores` |

## 구조
- `index.html` : 게임 목록 첫 화면
- `<게임>/index.html` : 게임 본체 (한 파일)
- `<게임>/thumb.jpg` : 목록에 보이는 썸네일

## 새 게임 추가하기
1. 새 폴더를 만들고 `index.html`을 넣습니다.
2. 랭킹이 필요하면 게임 코드의 `COLLECTION_NAME`을 게임마다 다른 이름으로 정합니다.
3. 첫 화면 `index.html`에 게임 카드를 하나 추가합니다.

## Cloudflare Pages 설정
- Framework preset: None
- Build command: (비워 둠)
- Build output directory: `/`
