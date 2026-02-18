
[사찰 회원 관리 시스템]

# 개발 스택

  - Electron
  - React
  - TypeScript
  - Vite (build)
  - Tailwind CSS v4
  - shadcn (ui)
  - lucide-react
  - react-window
  - react-virtualized-auto-sizer
  - xlsx


# 프로젝트 구조

  src/
  ├─ components/
  │   ├─ header.tsx
  │   ├─ memberTable.tsx
  │   └─ ui/ (shadcn 컴포넌트)
  │
  ├─ hooks/
  │   ├─ useMembers.ts 
  │   └─ useSms.ts
  │
  ├─ service/
  │   └─ excelService.ts
  │
  ├─ types/
  │   └─ member.ts
  │
  └─ App.tsx

  
# 실행방법
 1. 루트경로 진입
 2. npm install
 3. npm run dev


# exe 추출
 1. npm run dist
 2. setup 파일 실행 및 설치
 3. exe 실행
