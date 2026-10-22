# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React Native 기반 Android/iOS 개인용 앱(사용자 본인 1명, 스토어 미배포, D-011). 서비스 상세는 `docs/product.md`

## Project status

futureETP: 2026-10-22 기준 기획 단계 (TODO 1단계 기획·Step 2 리서치 완료, 다음은 2단계 Tech Stack. 소스 코드 없음). 진행 현황은 `TODO.md`

## Critical Rules

- 프로젝트 전용 규칙만 기재 (공통 규칙은 전역 `~/.claude/CLAUDE.md`)

## Docs

작업 전 관련 문서만 골라 읽는다 (항상 로드하지 않도록 `@` import 대신 경로로만 참조). 결정이 바뀌면 해당 문서도 함께 갱신한다.

- `TODO.md`: 단계별 진행 체크리스트
- `docs/product.md`: 서비스 기획 (개요, MVP 범위, 사용자 흐름, 데이터 모델, 외부 연동)
- `docs/data-model.md`: 서버 DB 논리 모델 (Mermaid erDiagram)
- `docs/wireframes/screens.md`: 화면 와이어프레임(ASCII)과 화면별 세부 동작
- `docs/tech-stack.md`: 확정된 기술 스택 (결과만)
- `docs/architecture.md`: 디렉터리 구조, 레이어, API/에러 규약, 환경 분리
- `docs/decisions.md`: 결정 기록과 근거 (D-xxx)
- `docs/research/`: Step 2 리서치 결과 (소스 비교, 비용, 출처)

## Tech Stack

- Frontend: Expo (개발 빌드, CNG) — D-027
- Backend:
- DB:
- Infra:

## Key Patterns

> 아래 Key Patterns·Coding Conventions는 잠정 규칙이다. TODO 2단계(Tech Stack)에서 확정한다.

- API error는 'AppError' class로 통일

## Coding Conventions
- component: PascalCase
- util/hook: camelCase
- commit message: Conventional Commits ('feat:', 'fix:', 'chore:')
- React component는 named export 사용 (default export 금지). 예외: `app/` 아래 Expo Router route 파일(`_layout` 포함)은 default export만 하고, `app/` 밖의 named export 화면을 다시 내보내기만 한다 (D-029)
- API response은 항상 '{ success, data, error }' 형태로 통일

## Architecture

<!-- 여러 파일을 읽어야 이해되는 큰 구조 -->

## Domain Context

## Commands

<!-- build / lint / test / 단일 테스트 실행 명령 -->

## Build & Test Commands

