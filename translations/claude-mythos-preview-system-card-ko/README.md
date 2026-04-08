# Claude Mythos Preview System Card — Korean Translation Workspace

이 폴더는 `Claude Mythos Preview System Card.pdf`의 한국어 번역 작업용 작업 공간입니다.
영문 원본 PDF와 최종 한글 번역본을 함께 저장합니다.

## 구성

- `build_translation.py`: 원본 PDF 추출, 번역, 마크다운 생성, PDF 조판까지 한 번에 수행하는 스크립트
- `source/original/Claude Mythos Preview System Card.pdf`: 영문 원본 PDF
- `source/`: 원본에서 추출한 텍스트 및 생성 자산
- `output/`: 최종 한국어 번역본

## 기본 출력 파일

- `output/claude-mythos-preview-system-card-ko.md`
- `output/claude-mythos-preview-system-card-ko.pdf`
- `source/original/Claude Mythos Preview System Card.pdf`

## 실행

```bash
python3 -m venv translations/claude-mythos-preview-system-card-ko/.venv
translations/claude-mythos-preview-system-card-ko/.venv/bin/python -m pip install reportlab
translations/claude-mythos-preview-system-card-ko/.venv/bin/python \
  translations/claude-mythos-preview-system-card-ko/build_translation.py
```

## 메모

- 번역 스타일은 `natural`, 형식 보존 모드는 `preserve`를 기준으로 구성했습니다.
- 그림/표 캡션은 한국어로 번역합니다.
- 원본 figure 이미지는 페이지 기준으로 매칭해 한국어 캡션 앞에 배치합니다.
- PDF는 macOS 기본 한글 글꼴인 `AppleGothic.ttf`를 사용합니다.
- 스크립트는 저장소 안의 영문 원본 PDF를 우선 사용하고, 없을 때만 Desktop 원본을 fallback으로 참조합니다.
