# Linear Workspace

Claude Code에서 MCP 서버를 통해 이메일 확인 → 분류 → Linear 이슈 생성까지 처리하는 워크스페이스.

## 아키텍처

```
[Outlook 이메일] → Email MCP (stdio) → Claude → Linear MCP (HTTP/OAuth) → [Linear 이슈]
[GitHub PR]      → gh CLI ─────────────────────┘
```

## MCP 서버

| 서버 | 전송 방식 | 설명 |
|------|-----------|------|
| linear-mcp | HTTP (OAuth) | [Linear 공식 MCP](https://mcp.linear.app/mcp) — 이슈 조회/생성/수정 |
| email-mcp | stdio | 자체 제작 — Outlook IMAP OAuth2로 이메일 읽기/검색/삭제 |

## 설정

### 1. 의존성 설치

```bash
cd email-mcp && npm install
```

### 2. 환경변수 설정

```bash
cp email-mcp/.env.example email-mcp/.env
```

`.env`에 IMAP 및 Azure AD 값 입력:

- `IMAP_USER` — Outlook 이메일 주소
- `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_CLIENT_SECRET` — Azure 앱 등록 정보

### 3. OAuth 인증

```bash
cd email-mcp && npm run setup
```

브라우저에서 Microsoft 로그인 → 토큰이 `~/.email-mcp/token-cache.json`에 캐시됨.

### 4. Claude Code에서 사용

`.mcp.json`이 프로젝트에 포함되어 있으므로, Claude Code 시작 시 자동으로 MCP 서버가 등록됩니다.

```bash
cd /path/to/linear
claude
```

## email-mcp 도구

| 도구 | 설명 |
|------|------|
| `list_emails` | 최근 이메일 목록 조회 |
| `read_email` | UID로 이메일 본문 읽기 |
| `search_emails` | 키워드/발신자/날짜/읽음 여부로 검색 |
| `delete_emails` | UID 목록으로 이메일 삭제 |

## Azure AD 앱 등록 (OAuth2 IMAP)

1. [Azure Portal](https://portal.azure.com) → Microsoft Entra ID → 앱 등록 → 새 등록
2. 리디렉션 URI: `http://localhost:53847/callback`
3. API 권한: `IMAP.AccessAsUser.All`, `offline_access`
4. 클라이언트 비밀 생성

## 프로젝트 구조

```
linear/
├── .mcp.json              ← MCP 서버 설정 (git 추적)
├── email-mcp/             ← 자체 이메일 MCP 서버
│   ├── index.js           ← MCP 서버 진입점
│   ├── lib/
│   │   ├── auth.js        ← Azure OAuth2 토큰 관리
│   │   └── imap.js        ← IMAP 클라이언트
│   ├── setup-auth.js      ← OAuth 초기 인증 스크립트
│   ├── .env.example       ← 환경변수 템플릿
│   └── package.json
└── to-linear/             ← 기존 CLI 파이프라인 (submodule)
```
