#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import socket
import subprocess
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image as RLImage
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, Preformatted, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parent
LOCAL_SOURCE_PDF = ROOT / "source" / "original" / "Claude Mythos Preview System Card.pdf"
SOURCE_PDF = LOCAL_SOURCE_PDF if LOCAL_SOURCE_PDF.exists() else Path.home() / "Desktop" / "Claude Mythos Preview System Card.pdf"
SOURCE_TXT = ROOT / "source" / "claude_mythos_preview_system_card_source.txt"
CACHE_JSON = ROOT / "tmp" / "translation_cache.json"
BLOCKS_JSON = ROOT / "tmp" / "blocks.json"
MARKDOWN_OUT = ROOT / "output" / "claude-mythos-preview-system-card-ko.md"
PDF_OUT = ROOT / "output" / "claude-mythos-preview-system-card-ko.pdf"
FONT_PATH = Path("/System/Library/Fonts/Supplemental/AppleGothic.ttf")
PDFIMAGES_LIST = ROOT / "tmp" / "pdfimages-list.txt"
EXTRACTED_IMAGES_DIR = ROOT / "source" / "images"
socket.setdefaulttimeout(12)

HEADING_LINE_RE = re.compile(r"^(\d+(?:\.\d+)*)\s+(.+)$")
TOC_LINE_RE = re.compile(r"^(\s*)(\d+(?:\.\d+)*)?(\s*)(.+?)(\s+)(\d+)\s*$")
FIGURE_RE = re.compile(r"^\[(Figure|Table)\s+([^\]]+)\]\s*(.+)$")
PAGE_NUMBER_RE = re.compile(r"^\s*\d+\s*$")

HEADING_OVERRIDES = {
    "Abstract": "초록",
    "Introduction": "서론",
    "Results": "결과",
    "Details": "세부 내용",
    "Rationale": "근거",
    "Contamination": "데이터 오염",
    "Model weaknesses": "모델의 약점",
    "Benchmark of notable capability": "주목할 만한 역량의 기준",
    "Benchmarks of notable capability": "주목할 만한 역량의 기준",
    "Conclusion": "결론",
    "Appendix": "부록",
    "Cyber": "사이버",
    "Capabilities": "역량",
    "Impressions": "인상",
}

PHRASE_OVERRIDES = {
    "Claude Mythos Preview": "Claude Mythos Preview",
    "Claude Opus 4.6": "Claude Opus 4.6",
    "Claude Opus 4.5": "Claude Opus 4.5",
    "Responsible Scaling Policy": "Responsible Scaling Policy",
    "Frontier Compliance Framework": "Frontier Compliance Framework",
    "Claude Code": "Claude Code",
    "Anthropic": "Anthropic",
    "OSWorld": "OSWorld",
    "BrowseComp": "BrowseComp",
    "CyberGym": "CyberGym",
    "Cybench": "Cybench",
}

POLISH_REPLACEMENTS = [
    ("시스템 카드: Claude Mythos Preview 프리뷰", "Claude Mythos Preview 시스템 카드"),
    ("군중 노동자", "크라우드 워커"),
    ("크라우드 작업자", "크라우드 워커"),
    ("사이버짐", "CyberGym"),
    ("정렬 평가", "얼라인먼트 평가"),
    ("정렬 관련 캐주얼 보고서", "얼라인먼트 관련 비공식 보고"),
    ("자동화된 행동 감사", "자동 행동 감사"),
    ("유용한 전용 버전인", "유용성만 남긴 전용 버전인"),
    ("모델 지원 그룹", "모델 사용 그룹"),
    ("지원 그룹", "사용 그룹"),
    ("에이전트 실행", "에이전트 실행 실험"),
    ("주목할만한 기능의 벤치마크", "주목할 만한 역량 기준"),
    ("주목할만한 기능", "주목할 만한 역량"),
    ("주목할만한", "주목할 만한"),
    ("재앙적인 생물학", "재앙적 생물학"),
    ("클로드 자기선호 평가", "Claude 자기선호 평가"),
    ('반복되는 "안녕" 메시지에 대한 행동', '반복되는 "hi" 메시지에 대한 반응'),
    ("찾아보기Comp", "BrowseComp"),
    ("스크린스팟-프로", "ScreenSpot-Pro"),
    ("사이벤치", "Cybench"),
    ("해킹평가 보상", "보상 해킹 평가"),
    ("성적 증명서", "트랜스크립트"),
    ("평가의식", "평가 인식"),
    ("평가인식", "평가 인식"),
    ("OS월드", "OSWorld"),
    ("노출수", "인상"),
    ('"유용한" 버전', '"helpful-only" 버전'),
    ("유용한 모델", "helpful-only 모델"),
    ("스래싱에 응답하세요", "스래싱에 대한 반응"),
]

PARAGRAPH_REPLACEMENTS = [
    (
        "얼라인먼트 평가 섹션에 있는 모델의 내부 버전. 모델이 다양한 행동에 관여할 때 모델의 내부를 연구하기 위해 해석 가능성 방법을 사용하는 분석뿐만 아니라 모델이 해당 구성을 얼마나 잘 준수하는지에 대한 새롭고 직접적인 평가도 포함됩니다. 이 업데이트된 문서는 모델이 어떻게 작동하기를 원하는지 설명하는 Anthropic에서 최근 게시한 업데이트입니다.",
        "또한 얼라인먼트 평가 섹션에서는 모델이 다양한 행동을 보일 때 내부 표현을 해석 가능성 기법으로 분석하고, Anthropic이 최근 갱신한 헌법적 목표를 모델이 얼마나 잘 따르는지 직접 측정한 새로운 평가도 함께 다룹니다.",
    ),
    (
        "여러 개의 대규모 언어 모델을 사용하는 일반 사용자라면 각 모델마다 고유한 전체적인 특성이 있다는 것을 알 것입니다. 이 캐릭터의 미묘한 측면은 공식적인 평가에서 포착하기 어려운 경우가 많습니다. 이러한 이유로 처음으로 '노출수' 섹션을 포함했습니다. 여기에는 지난 몇 주 동안 모델을 테스트해 온 다양한 Anthropic 직원이 제공한 특히 인상적이거나, 공개적이거나, 재미 있거나, 흥미로운 모델 출력의 발췌 내용이 포함되어 있습니다.",
        "여러 대규모 언어 모델을 함께 써 본 사용자는 각 모델마다 고유한 결이 있다는 점을 체감할 것입니다. 이런 미묘한 성향은 정량 평가만으로는 잘 포착되지 않기 때문에, 이번 시스템 카드에는 처음으로 '인상' 섹션을 넣었습니다. 여기에는 지난 몇 주 동안 모델을 시험해 온 Anthropic 직원들이 특히 인상적이거나, 뜻밖이거나, 흥미롭다고 본 출력 사례를 발췌해 담았습니다.",
    ),
    (
        "여러 개의 대규모 언어 모델을 사용하는 일반 사용자라면 각 모델마다 고유한 전체적인 특성이 있다는 것을 알 것입니다. 이 캐릭터의 미묘한 측면은 공식적인 평가에서 포착하기 어려운 경우가 많습니다. 이러한 이유로 처음으로 '인상' 섹션을 포함했습니다. 여기에는 지난 몇 주 동안 모델을 테스트해 온 다양한 Anthropic 직원이 제공한 특히 인상적이거나, 공개적이거나, 재미 있거나, 흥미로운 모델 출력의 발췌 내용이 포함되어 있습니다.",
        "여러 대규모 언어 모델을 함께 써 본 사용자는 각 모델마다 고유한 결이 있다는 점을 체감할 것입니다. 이런 미묘한 성향은 정량 평가만으로는 잘 포착되지 않기 때문에, 이번 시스템 카드에는 처음으로 '인상' 섹션을 넣었습니다. 여기에는 지난 몇 주 동안 모델을 시험해 온 Anthropic 직원들이 특히 인상적이거나, 뜻밖이거나, 흥미롭다고 본 출력 사례를 발췌해 담았습니다.",
    ),
    (
        "Claude Mythos Preview는 인터넷, 공개 및 비공개 데이터 세트와 다른 사용자가 생성한 합성 데이터에서 공개적으로 사용 가능한 정보의 독점 혼합에 대해 교육을 받았습니다.\n\n모델. 훈련 과정 전반에 걸쳐 우리는 중복 제거 및 분류를 포함한 여러 가지 데이터 정리 및 필터링 방법을 사용했습니다.",
        "Claude Mythos Preview는 인터넷, 공개 및 비공개 데이터 세트, 그리고 기타 합성 데이터에서 수집한 공개 가용 정보를 혼합해 학습했습니다.\n\n훈련 전 과정에서 우리는 중복 제거와 분류를 포함한 다양한 데이터 정제 및 필터링 절차를 적용했습니다.",
    ),
    (
        "특히 이는 방어 목적(소프트웨어 코드의 취약점 발견 및 해결)과 공격 목적(해당 취약점을 악용하는 정교한 방법 설계) 모두에 사용할 수 있는 강력한 사이버 보안 기술을 입증했습니다. 우리가 Claude Mythos Preview를 일반 공급용으로 출시하지 않기로 결정한 것은 주로 이러한 기능 때문입니다.",
        "특히 이 모델은 방어 목적(소프트웨어 코드의 취약점 발견 및 수정)과 공격 목적(그 취약점을 악용하는 정교한 방법 설계) 모두에 활용될 수 있는 강력한 사이버 보안 역량을 보여주었습니다. 우리가 Claude Mythos Preview를 일반 공개하지 않기로 결정한 가장 큰 이유도 바로 이 역량입니다.",
    ),
    (
        "모델을 방어 목적으로 가치있게 만드는 동일한 기능은 광범위하게 사용 가능하다면 본질적으로 이중 용도 특성을 고려할 때 공격적인 활용을 가속화할 수도 있습니다.",
        "모델을 방어 목적으로 유용하게 만드는 바로 그 역량은, 널리 공개될 경우 이중용도 특성상 공격적 악용도 가속할 수 있습니다.",
    ),
    (
        "RSP에 따라 우리는 모델의 안전 프로필을 다루는 포괄적인 위험 보고서를 정기적으로 게시합니다.",
        "RSP에 따라 우리는 모델의 안전 프로필을 다루는 포괄적 위험 보고서를 정기적으로 게시합니다.",
    ),
    (
        "### 관련성 평가 설명\n\n알려진 전문가 레드 모델이 재앙적이고 새로운 CB 팀 구성의 화학/생물학적 무기 개발에 향상을 제공할 수 있습니까? 무기\n\n알려진 바이러스학 프로토콜 도전적인 무기 바이러스를 합성하기 위한 상세한 생물학적 향상 시험 엔드투엔드 프로토콜을 만드는 데 모델이 인간 전문가를 향상시킬 수 있습니까?\n\n자동화 에이전트 시스템이 바이러스 획득, 설계 및 합성에 이르는 중간 수준의 개별 작업을 완료할 수 있습니까? 평가 이미지가 포함된 긴 형태의 바이러스학에 관한 질문에 대해 모델이 얼마나 잘 수행됩니까? 바이러스학 작업 모델이 유전자 다중 모드 합성 스크리닝을 우회하는 DNA 단편을 설계할 수 있습니까? 바이러스학(VCT) DNA 합성 스크리닝 회피\n\n새로운 재앙 모델이 재앙 가능성이 있는 시나리오의 생물학적 생물학적 시나리오 구성에 대한 박사 교육을 통해 개인의 역량을 향상시킬 수 있습니까? 무기 개량 재판\n\nSequence-to- 모델이 기능 모델링, 보정된 생물학적 서열 모델링 및 설계 및 설계 작업에서 전문가의 인간 성능과 일치할 수 있습니까? [표 2.2.4.A] 화학/생물학적 무기에 대한 평가.",
        "### 평가 개요\n\n전문가 레드팀: 재앙적 피해를 낼 수 있는 알려진 또는 새로운 화학·생물학 무기 개발을 모델이 얼마나 실질적으로 도울 수 있는지 평가했습니다.\n\n바이러스학 프로토콜 향상 시험: 까다로운 무기화 가능 바이러스를 합성하기 위한 상세한 엔드투엔드 프로토콜 작성에서 모델이 인간 전문가의 역량을 얼마나 끌어올릴 수 있는지 평가했습니다.\n\nCB-1 관련 자동 평가: 바이러스 획득, 설계, 합성으로 이어지는 중간 수준의 개별 과업을 자동화 에이전트가 수행할 수 있는지 평가했습니다. 여기에는 장문형 바이러스학 과제, 이미지가 포함된 바이러스학 질의응답, DNA 합성 스크리닝 회피 설계 과제가 포함됩니다.\n\n재앙적 생물학 시나리오 향상 시험: 모델이 박사 수준 생물학자의 역량을 끌어올려 재앙 가능성이 있는 생물학 시나리오를 신뢰성 있게 구성하도록 도울 수 있는지 평가했습니다.\n\nSequence-to-Function 모델링 및 설계: 보정된 생물학적 서열 모델링 및 설계 과제에서 모델이 인간 전문가 수준의 성능에 도달하는지 평가했습니다.\n\n[표 2.2.4.A] 화학 및 생물학 무기 관련 평가 개요.",
    ),
    (
        "Claude Mythos Preview가 문제의 임계값을 넘지 않는다고 판단한 주된 이유는 일상적인 작업 과정에서 광범위하게 사용하고 그러한 작업을 자동화할 수 있는 영역을 탐색해 왔지만 아직 그럴 것 같지 않습니다.\n\n연구 과학자와 연구 엔지니어, 특히 상대적으로 고위직을 대체할 수 있는 수준에 가깝습니다.",
        "Claude Mythos Preview가 해당 임계값을 넘지 않았다고 판단한 가장 큰 이유는, 우리가 일상적인 업무 흐름에서 이 모델을 광범위하게 활용하며 자동화 가능성을 탐색해 왔음에도 아직 연구 과학자나 연구 엔지니어, 특히 비교적 고위 역할을 대체할 수준에는 이르지 못했다고 보았기 때문입니다.",
    ),
    (
        "## 6.2 데이터 오염 공개 벤치마크의 질문에 대한 답변이 모델의 훈련 데이터에 실수로 나타날 수 있으며, 이로 인해 모델이 달성할 수 있는 점수가 부풀려질 수 있습니다. 우리는 평가의 오염을 제거하기 위해 몇 가지 조치를 취합니다. 전체 방법론은 Claude Opus 4.5 시스템 카드의 섹션 2.2를 참조하세요. 다중 모드 오염 제거를 위해 우리는 지각 해시가 다중 모드 평가에 포함된 이미지의 해시와 일치하는 이미지가 있는 훈련 샘플을 추가로 삭제합니다.",
        "## 6.2 데이터 오염\n\n공개 벤치마크의 문항과 정답이 모델의 훈련 데이터에 우연히 포함되면 점수가 실제보다 부풀려질 수 있습니다. 우리는 평가 데이터 오염을 줄이기 위해 여러 조치를 적용했습니다. 전체 방법론은 Claude Opus 4.5 시스템 카드의 섹션 2.2를 참조하세요. 다중모달 오염 제거를 위해서는 평가 이미지의 해시와 일치하는 지각 해시를 포함한 훈련 샘플도 추가로 제거했습니다.",
    ),
    (
        "2 책임 있는 확장 정책(RSP)은 고급 AI 시스템의 치명적인 위험을 관리하기 위한 자발적인 프레임워크입니다.3 이는 위험을 식별하고 평가하는 방법, AI 개발 및 배포에 대한 결정을 내리는 방법, 그리고 전 세계의 관점에서 모델의 이점이 비용을 초과하는지 확인하는 방법을 설정합니다.",
        "RSP(책임 있는 확장 정책)는 고급 AI 시스템의 치명적 위험을 관리하기 위한 자발적 프레임워크입니다. 이 정책은 위험을 식별하고 평가하는 방법, AI 개발 및 배포에 관한 결정을 내리는 방식, 그리고 전 세계적 관점에서 모델의 편익이 비용을 웃도는지 판단하는 기준을 규정합니다.",
    ),
    (
        "공개 벤치마크의 질문에 대한 답변이 모델의 훈련 데이터에 실수로 나타날 수 있으며, 이로 인해 모델이 달성할 수 있는 점수가 부풀려질 수 있습니다. 우리는 평가의 오염을 제거하기 위해 몇 가지 조치를 취합니다. 전체 방법론은 Claude Opus 4.5 시스템 카드의 섹션 2.2를 참조하세요. 다중 모드 오염 제거를 위해 우리는 지각 해시가 다중 모드 평가에 포함된 이미지의 해시와 일치하는 이미지가 있는 훈련 샘플을 추가로 삭제합니다.",
        "공개 벤치마크의 문항과 정답이 모델의 훈련 데이터에 우연히 포함되면 점수가 실제보다 부풀려질 수 있습니다. 우리는 평가 데이터 오염을 줄이기 위해 여러 조치를 적용했습니다. 전체 방법론은 Claude Opus 4.5 시스템 카드의 섹션 2.2를 참조하세요. 다중모달 오염 제거를 위해서는 평가 이미지의 해시와 일치하는 지각 해시를 포함한 훈련 샘플도 추가로 제거했습니다.",
    ),
]


@dataclass
class Block:
    page: int
    kind: str
    text: str
    level: int | None = None


@dataclass
class SourceImage:
    page: int
    width: int
    height: int
    path: Path


def ensure_dirs() -> None:
    for path in [ROOT / "output", ROOT / "tmp", ROOT / "source"]:
        path.mkdir(parents=True, exist_ok=True)


def run_pdftotext() -> None:
    subprocess.run(
        ["pdftotext", "-layout", str(SOURCE_PDF), str(SOURCE_TXT)],
        check=True,
    )


def run_pdfimages_list() -> None:
    with PDFIMAGES_LIST.open("w", encoding="utf-8") as handle:
        subprocess.run(
            ["pdfimages", "-list", str(SOURCE_PDF)],
            check=True,
            stdout=handle,
        )


def extract_source_images() -> None:
    EXTRACTED_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    if any(EXTRACTED_IMAGES_DIR.glob("img-*.png")):
        return
    subprocess.run(
        ["pdfimages", "-png", str(SOURCE_PDF), str(EXTRACTED_IMAGES_DIR / "img")],
        check=True,
    )


def load_cache() -> dict[str, str]:
    if CACHE_JSON.exists():
        return json.loads(CACHE_JSON.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: dict[str, str]) -> None:
    CACHE_JSON.write_text(
        json.dumps(cache, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def is_probable_heading(text: str) -> bool:
    plain = normalize_spaces(text)
    if not plain:
        return False
    if plain in HEADING_OVERRIDES:
        return True
    if HEADING_LINE_RE.match(plain):
        return True
    if len(plain) > 90:
        return False
    if plain.endswith((".", "?", "!", ":", ";")):
        return False
    words = plain.split()
    return 1 <= len(words) <= 10


def is_toc_block(lines: list[str]) -> bool:
    return sum(1 for line in lines if TOC_LINE_RE.match(line)) >= max(2, len(lines) // 2)


def join_lines(lines: list[str]) -> str:
    if not lines:
        return ""
    if is_toc_block(lines):
        return "\n".join(line.rstrip() for line in lines)
    if any(line.lstrip().startswith(("●", "-", "•")) for line in lines):
        items = []
        current: list[str] = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith(("●", "-", "•")):
                if current:
                    items.append(normalize_spaces(" ".join(current)))
                current = [stripped]
            else:
                current.append(stripped)
        if current:
            items.append(normalize_spaces(" ".join(current)))
        return "\n".join(items)

    merged: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if merged and merged[-1].endswith("-") and stripped[:1].islower():
            merged[-1] = merged[-1][:-1] + stripped
        else:
            merged.append(stripped)
    return normalize_spaces(" ".join(merged))


def classify_block(text: str) -> tuple[str, int | None]:
    plain = normalize_spaces(text)
    if not plain:
        return "skip", None
    if FIGURE_RE.match(plain):
        return "caption", None
    if "\n" in text and is_toc_block(text.splitlines()):
        return "toc", None
    if HEADING_LINE_RE.match(plain):
        level = plain.split()[0].count(".") + 1
        return "heading", min(level, 4)
    if is_probable_heading(plain):
        return "heading", 2 if plain in HEADING_OVERRIDES else 3
    if "\n" in text and any(line.lstrip().startswith(("●", "-", "•")) for line in text.splitlines()):
        return "list", None
    return "paragraph", None


def parse_blocks() -> list[Block]:
    raw_pages = SOURCE_TXT.read_text(encoding="utf-8").split("\f")
    blocks: list[Block] = []
    for page_num, raw_page in enumerate(raw_pages, start=1):
        lines = [line.rstrip() for line in raw_page.splitlines()]
        current: list[str] = []
        for line in lines:
            if PAGE_NUMBER_RE.match(line):
                continue
            if not line.strip():
                text = join_lines(current)
                kind, level = classify_block(text)
                if kind != "skip":
                    blocks.append(Block(page=page_num, kind=kind, text=text, level=level))
                current = []
                continue
            current.append(line)
        text = join_lines(current)
        kind, level = classify_block(text)
        if kind != "skip":
            blocks.append(Block(page=page_num, kind=kind, text=text, level=level))
    BLOCKS_JSON.write_text(
        json.dumps([block.__dict__ for block in blocks], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return blocks


def build_toc_title_map(blocks: list[Block]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for block in blocks:
        if block.kind != "toc":
            continue
        for line in block.text.splitlines():
            match = TOC_LINE_RE.match(line.replace("\u200b", ""))
            if not match:
                continue
            _indent, number, _gap_a, title, _gap_b, _page = match.groups()
            if number:
                mapping[number] = normalize_spaces(title)
    return mapping


def split_embedded_headings(blocks: list[Block]) -> list[Block]:
    toc_title_map = build_toc_title_map(blocks)
    expanded: list[Block] = []

    for block in blocks:
        if block.kind in {"toc", "caption", "list", "skip"}:
            expanded.append(block)
            continue

        clean = normalize_spaces(block.text)
        if not clean:
            expanded.append(block)
            continue

        heading_match = HEADING_LINE_RE.match(clean)
        if heading_match:
            number, remainder = heading_match.groups()
            expected_title = toc_title_map.get(number)
            if expected_title and remainder.startswith(expected_title) and normalize_spaces(remainder) != expected_title:
                rest = remainder[len(expected_title) :].strip()
                expanded.append(
                    Block(
                        page=block.page,
                        kind="heading",
                        text=f"{number} {expected_title}",
                        level=min(number.count(".") + 1, 4),
                    )
                )
                if rest:
                    expanded.append(Block(page=block.page, kind="paragraph", text=rest, level=None))
                continue

        for heading in HEADING_OVERRIDES:
            if clean == heading:
                break
            if clean.startswith(f"{heading} "):
                rest = clean[len(heading) :].strip()
                expanded.append(Block(page=block.page, kind="heading", text=heading, level=2))
                if rest:
                    expanded.append(Block(page=block.page, kind="paragraph", text=rest, level=None))
                break
        else:
            expanded.append(block)

    return expanded


def parse_source_images() -> list[SourceImage]:
    entries: list[SourceImage] = []
    extracted_index = 0
    lines = PDFIMAGES_LIST.read_text(encoding="utf-8").splitlines()
    for line in lines[2:]:
        parts = line.split()
        if len(parts) < 6:
            continue
        page, _num, img_type, width, height = parts[:5]
        if img_type not in {"image", "smask"}:
            continue
        path = EXTRACTED_IMAGES_DIR / f"img-{extracted_index:03d}.png"
        extracted_index += 1
        if img_type != "image":
            continue
        if not path.exists():
            continue
        width_i = int(width)
        height_i = int(height)
        if int(page) <= 1 or width_i < 500 or height_i < 120:
            continue
        entries.append(
            SourceImage(
                page=int(page),
                width=width_i,
                height=height_i,
                path=path,
            )
        )
    return entries


def translate_request(text: str) -> str:
    clean_text = text.replace("\u200b", "").strip()
    params = {
        "client": "gtx",
        "sl": "en",
        "tl": "ko",
        "dt": "t",
        "q": clean_text,
    }
    url = "https://translate.googleapis.com/translate_a/single?" + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            response = subprocess.run(
                [
                    "curl",
                    "-A",
                    "Mozilla/5.0",
                    "--max-time",
                    "12",
                    "-fsSL",
                    url,
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            payload = json.loads(response.stdout)
            return "".join(part[0] for part in payload[0])
        except Exception:
            time.sleep(0.8 * (attempt + 1))

    fallback_url = (
        "https://api.mymemory.translated.net/get?"
        + urllib.parse.urlencode({"q": clean_text, "langpair": "en|ko"})
    )
    response = subprocess.run(
        [
            "curl",
            "-A",
            "Mozilla/5.0",
            "--max-time",
            "12",
            "-fsSL",
            fallback_url,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(response.stdout)
    return payload["responseData"]["translatedText"]


def apply_phrase_overrides(text: str) -> str:
    updated = text
    for source, target in PHRASE_OVERRIDES.items():
        updated = updated.replace(source, target)
    updated = updated.replace("신화 프리뷰", "Mythos Preview")
    updated = updated.replace("시스템 카드", "시스템 카드")
    return updated


def polish_text(text: str) -> str:
    polished = text
    for source, target in POLISH_REPLACEMENTS:
        polished = polished.replace(source, target)
    for source, target in PARAGRAPH_REPLACEMENTS:
        polished = polished.replace(source, target)
    return polished


def translate_heading(text: str, level: int | None) -> str:
    clean = text.replace("\u200b", "").strip()
    match = HEADING_LINE_RE.match(clean)
    if match:
        prefix, title = match.groups()
        translated = HEADING_OVERRIDES.get(title, apply_phrase_overrides(translate_request(title)))
        return f"{prefix} {translated}"
    return HEADING_OVERRIDES.get(clean, apply_phrase_overrides(translate_request(clean)))


def translate_toc_line(line: str) -> str:
    clean_line = line.replace("\u200b", "")
    match = TOC_LINE_RE.match(clean_line)
    if not match:
        stripped = normalize_spaces(clean_line)
        return HEADING_OVERRIDES.get(stripped, apply_phrase_overrides(translate_request(stripped)))
    indent, number, gap_a, title, gap_b, page = match.groups()
    stripped_title = title.strip()
    if number:
        heading_text = f"{number} {stripped_title}".strip()
        translated_heading = translate_heading(heading_text, None)
        translated_title = translated_heading[len(number) :].strip()
    else:
        translated_title = HEADING_OVERRIDES.get(stripped_title, apply_phrase_overrides(translate_request(stripped_title)))
    return f"{indent}{number or ''}{gap_a}{translated_title}{gap_b}{page}".rstrip()


def translate_caption(text: str) -> str:
    match = FIGURE_RE.match(text)
    if not match:
        return apply_phrase_overrides(translate_request(text))
    label, ident, body = match.groups()
    translated_label = "그림" if label == "Figure" else "표"
    translated_body = apply_phrase_overrides(translate_request(body))
    return f"[{translated_label} {ident}] {translated_body}"


def translate_list(text: str) -> str:
    items = []
    for line in text.splitlines():
        bullet = line[:1]
        body = line[1:].strip() if bullet in {"●", "-", "•"} else line.strip()
        translated = apply_phrase_overrides(translate_request(body))
        if bullet in {"●", "-", "•"}:
            items.append(f"{bullet} {translated}")
        else:
            items.append(translated)
    return "\n".join(items)


def batch_translate_texts(texts: list[str]) -> list[str]:
    if not texts:
        return []
    tagged_parts = []
    markers = []
    for index, text in enumerate(texts, start=1):
        marker = f"[[[{index:04d}]]]"
        markers.append(marker)
        tagged_parts.append(f"{marker}\n{text.replace(chr(0x200b), '').strip()}")
    combined = "\n\n".join(tagged_parts)
    translated = translate_request(combined)
    segments = re.split(r"(\[\[\[\d{4}\]\]\])", translated)
    found: dict[str, str] = {}
    current_marker = None
    for part in segments:
        if not part:
            continue
        if re.fullmatch(r"\[\[\[\d{4}\]\]\]", part):
            current_marker = part
            found[current_marker] = ""
            continue
        if current_marker is not None:
            found[current_marker] += part

    results = []
    for marker, original in zip(markers, texts):
        piece = found.get(marker, "").strip()
        if not piece:
            piece = apply_phrase_overrides(translate_request(original))
        results.append(piece)
    return results


def finalize_batched_translation(block: Block, translated: str) -> str:
    clean_original = block.text.replace("\u200b", "").strip()
    if block.kind == "heading":
        if clean_original in HEADING_OVERRIDES:
            return HEADING_OVERRIDES[clean_original]
        match = HEADING_LINE_RE.match(clean_original)
        if match:
            prefix, title = match.groups()
            if title in HEADING_OVERRIDES:
                return f"{prefix} {HEADING_OVERRIDES[title]}"
        return apply_phrase_overrides(translated)
    if block.kind == "list":
        return apply_phrase_overrides(translated)
    return apply_phrase_overrides(translated)


def translate_block(block: Block, cache: dict[str, str]) -> str:
    key = f"{block.kind}::{block.text}"
    if key in cache:
        return cache[key]

    if block.kind == "heading":
        translated = translate_heading(block.text, block.level)
    elif block.kind == "toc":
        translated = "\n".join(translate_toc_line(line) for line in block.text.splitlines())
    elif block.kind == "caption":
        translated = translate_caption(block.text)
    elif block.kind == "list":
        translated = translate_list(block.text)
    else:
        translated = apply_phrase_overrides(translate_request(block.text))

    cache[key] = translated
    return translated


def build_markdown(blocks: list[Block], translations: list[str]) -> None:
    lines = [
        "# Claude Mythos Preview 시스템 카드",
        "",
        "_원문: Claude Mythos Preview System Card (2026년 4월 7일)_",
        "",
    ]
    for block, translated in zip(blocks, translations):
        translated = polish_text(translated)
        if block.page == 1:
            continue
        if block.kind == "heading":
            level = min(block.level or 2, 4)
            lines.append("#" * level + " " + translated)
        elif block.kind == "caption":
            lines.append(f"> {translated}")
        elif block.kind == "toc":
            lines.append("```text")
            lines.extend(translated.splitlines())
            lines.append("```")
        elif block.kind == "list":
            lines.extend(translated.splitlines())
        else:
            lines.append(translated)
        lines.append("")
    MARKDOWN_OUT.write_text(polish_text("\n".join(lines).strip()) + "\n", encoding="utf-8")


def build_styles():
    if not FONT_PATH.exists():
        raise FileNotFoundError(f"한글 글꼴을 찾을 수 없습니다: {FONT_PATH}")

    pdfmetrics.registerFont(TTFont("AppleGothic", str(FONT_PATH)))

    base = getSampleStyleSheet()
    base.add(
        ParagraphStyle(
            name="KBody",
            parent=base["BodyText"],
            fontName="AppleGothic",
            fontSize=9.6,
            leading=15,
            spaceAfter=8,
        )
    )
    base.add(
        ParagraphStyle(
            name="KCaption",
            parent=base["BodyText"],
            fontName="AppleGothic",
            fontSize=8.3,
            leading=12,
            textColor=colors.HexColor("#4a4a4a"),
            spaceBefore=4,
            spaceAfter=8,
        )
    )
    base.add(
        ParagraphStyle(
            name="KToc",
            parent=base["Code"],
            fontName="AppleGothic",
            fontSize=8.4,
            leading=11,
            spaceAfter=8,
        )
    )
    base.add(
        ParagraphStyle(
            name="KTitle",
            parent=base["Title"],
            fontName="AppleGothic",
            fontSize=24,
            leading=30,
            alignment=TA_CENTER,
            spaceAfter=20,
        )
    )
    for name, size, leading in [
        ("KH1", 18, 24),
        ("KH2", 14, 20),
        ("KH3", 12, 17),
        ("KH4", 10.5, 15),
    ]:
        base.add(
            ParagraphStyle(
                name=name,
                parent=base["Heading2"],
                fontName="AppleGothic",
                fontSize=size,
                leading=leading,
                textColor=colors.HexColor("#101010"),
                spaceBefore=12,
                spaceAfter=8,
            )
        )
    return base


def escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "<br/>")
    )


def build_caption_image_map(blocks: list[Block], images: list[SourceImage]) -> dict[int, list[SourceImage]]:
    caption_indices_by_page: dict[int, list[int]] = {}
    for index, block in enumerate(blocks):
        if block.kind == "caption":
            caption_indices_by_page.setdefault(block.page, []).append(index)

    images_by_page: dict[int, list[SourceImage]] = {}
    for image in images:
        images_by_page.setdefault(image.page, []).append(image)

    mapping: dict[int, list[SourceImage]] = {}
    for page, page_images in images_by_page.items():
        caption_indices = caption_indices_by_page.get(page)
        if not caption_indices:
            continue
        if len(caption_indices) == 1:
            mapping[caption_indices[0]] = page_images
            continue
        for idx, image in enumerate(page_images):
            caption_slot = caption_indices[min(idx, len(caption_indices) - 1)]
            mapping.setdefault(caption_slot, []).append(image)
    return mapping


def make_image_flowables(image_entries: list[SourceImage], available_width: float) -> list:
    flowables = []
    for image_entry in image_entries:
        scale = min(available_width / image_entry.width, 5.9 * inch / image_entry.height, 1.0)
        flowables.append(
            RLImage(
                str(image_entry.path),
                width=image_entry.width * scale,
                height=image_entry.height * scale,
            )
        )
        flowables.append(Spacer(1, 0.12 * inch))
    return flowables


def draw_page_number(canvas, doc) -> None:
    canvas.setFont("AppleGothic", 8)
    canvas.setFillColor(colors.HexColor("#666666"))
    canvas.drawRightString(letter[0] - 0.72 * inch, 0.48 * inch, str(doc.page))


def build_pdf(blocks: list[Block], translations: list[str], images: list[SourceImage]) -> None:
    styles = build_styles()
    doc = SimpleDocTemplate(
        str(PDF_OUT),
        pagesize=letter,
        leftMargin=0.85 * inch,
        rightMargin=0.85 * inch,
        topMargin=0.8 * inch,
        bottomMargin=0.75 * inch,
        title="Claude Mythos Preview System Card - Korean Translation",
        author="Codex",
    )

    story = [
        Spacer(1, 1.6 * inch),
        Paragraph("Claude Mythos Preview", styles["KTitle"]),
        Paragraph("시스템 카드", styles["KTitle"]),
        Spacer(1, 0.2 * inch),
        Paragraph("2026년 4월 7일", styles["KH3"]),
        Spacer(1, 0.6 * inch),
        Paragraph("한국어 번역본", styles["KH2"]),
        PageBreak(),
    ]
    caption_image_map = build_caption_image_map(blocks, images)
    available_width = letter[0] - doc.leftMargin - doc.rightMargin

    for index, (block, translated) in enumerate(zip(blocks, translations)):
        translated = polish_text(translated)
        if block.page == 1:
            continue
        if block.kind == "heading":
            level = min(block.level or 2, 4)
            story.append(Paragraph(escape(translated), styles[f"KH{level}"]))
        elif block.kind == "caption":
            group = []
            if index in caption_image_map:
                group.extend(make_image_flowables(caption_image_map[index], available_width))
            group.append(Paragraph(escape(translated), styles["KCaption"]))
            story.append(KeepTogether(group))
        elif block.kind == "toc":
            story.append(Preformatted(translated, styles["KToc"]))
        elif block.kind == "list":
            for line in translated.splitlines():
                story.append(Paragraph(escape(line), styles["KBody"]))
        else:
            story.append(Paragraph(escape(translated), styles["KBody"]))

    doc.build(story, onFirstPage=draw_page_number, onLaterPages=draw_page_number)


def main() -> None:
    ensure_dirs()
    if not SOURCE_PDF.exists():
        raise FileNotFoundError(f"원본 PDF를 찾을 수 없습니다: {SOURCE_PDF}")

    run_pdftotext()
    run_pdfimages_list()
    extract_source_images()
    blocks = split_embedded_headings(parse_blocks())
    images = parse_source_images()
    cache = load_cache()
    translations: list[str] = []
    pending_batch: list[tuple[int, Block, str]] = []

    def flush_batch() -> None:
        nonlocal pending_batch
        if not pending_batch:
            return
        batch_texts = [text for _, _, text in pending_batch]
        batch_results = batch_translate_texts(batch_texts)
        for (index, block, _), translated_raw in zip(pending_batch, batch_results):
            finalized = finalize_batched_translation(block, translated_raw)
            translations[index] = finalized
            cache[f"{block.kind}::{block.text}"] = finalized
            save_cache(cache)
        pending_batch = []

    translations = [""] * len(blocks)
    for index, block in enumerate(blocks):
        cache_key = f"{block.kind}::{block.text}"
        if cache_key in cache:
            translations[index] = cache[cache_key]
        elif block.kind in {"paragraph", "heading", "list"}:
            pending_batch.append((index, block, block.text))
            total_chars = sum(len(item[2]) for item in pending_batch)
            if len(pending_batch) >= 8 or total_chars >= 2600:
                flush_batch()
        else:
            flush_batch()
            translations[index] = translate_block(block, cache)
            save_cache(cache)

        if (index + 1) % 10 == 0:
            print(f"[translate] {index + 1}/{len(blocks)} blocks", flush=True)
        time.sleep(0.03)

    flush_batch()

    save_cache(cache)
    build_markdown(blocks, translations)
    build_pdf(blocks, translations, images)
    print(f"[done] markdown: {MARKDOWN_OUT}")
    print(f"[done] pdf: {PDF_OUT}")


if __name__ == "__main__":
    main()
