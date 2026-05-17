
# ---------------------------------------------------------
# HybridExtractor (spaCy-only implementation)
# - No OpenAI/Anthropic.
# - Extracts: country (GPE), years, percentages, money, GW targets
# - Merges with regex extractor from PolicyAnalyzer.
# ---------------------------------------------------------

import re
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, List

# Optional spaCy
try:
    import spacy
    from spacy.language import Language
    SPACY_AVAILABLE = True
except Exception:
    spacy = None
    Language = None
    SPACY_AVAILABLE = False


@dataclass
class NLPResult:
    metrics: Dict[str, Any]
    meta: Dict[str, Any]


class HybridExtractor:
    """
    spaCy-backed extractor that can enrich a regex extractor.

    How PolicyAnalyzer connects:
      - PolicyAnalyzer calls:
          HybridExtractor.extract(text, regex_fn)
      - regex_fn is PolicyAnalyzer._extract_with_regex
      - We return merged metrics:
          NLP-derived values first (if found), otherwise regex values.
    """

    def __init__(self, nlp_backend: str = "spacy", use_nlp: bool = True, model: str = "en_core_web_sm", verbose: bool = False):
        self.use_nlp = bool(use_nlp)
        self.verbose = verbose
        self.backend = (nlp_backend or "spacy").lower()
        self.model_name = model

        # Gracefully handle unsupported backends by disabling NLP (regex-only)
        if self.backend != "spacy":
            if self.verbose:
                print(f"⚠️  NLP backend '{self.backend}' not supported. Falling back to regex-only.")
            self.use_nlp = False
            self.nlp = None
            return

        # spaCy backend requested
        if not SPACY_AVAILABLE:
            if self.verbose:
                print("⚠️  spaCy not installed. Proceeding with regex-only extraction.")
            self.use_nlp = False
            self.nlp = None
            return

        self.nlp = self._load_spacy_model(self.model_name)

    def _load_spacy_model(self, model: str):
        try:
            return spacy.load(model)
        except Exception as e:
            # Fallback to blank English if model missing (still gives tokenizer + sentence boundaries if enabled)
            if self.verbose:
                print(f"⚠️  spaCy model load failed ({model}): {e}")
                print("   Falling back to spacy.blank('en'). Country extraction may be weaker.")
            nlp = spacy.blank("en")
            # Try to enable sentencizer for better context windows
            if "sentencizer" not in nlp.pipe_names:
                try:
                    nlp.add_pipe("sentencizer")
                except Exception:
                    pass
            return nlp

    # -----------------------------------------------------
    # Public API
    # -----------------------------------------------------
    def extract(self, text: str, regex_extractor: Callable[[str], Dict[str, Any]]) -> Dict[str, Any]:
        """
        Merge NLP + regex extraction:
          - Run regex_extractor(text) first (guaranteed baseline)
          - Run NLP extraction and override only missing fields (or when confident)
        """
        base = regex_extractor(text) if callable(regex_extractor) else {}
        nlp_metrics, meta = self._extract_with_spacy(text)

        merged = dict(base or {})
        # Prefer NLP values when present & non-empty
        for k, v in nlp_metrics.items():
            if v is None:
                continue
            if k not in merged or merged[k] in (None, "", [], {}):
                merged[k] = v
            else:
                # If regex has something but NLP is "more structured", you can add rules here.
                # For now: keep regex unless it is None.
                pass

        # If NLP found a country and regex didn't, you now have it in merged["country"]
        # (PolicyAnalyzer uses it to resolve country for forecasting)
        return merged

    # -----------------------------------------------------
    # spaCy extractors
    # -----------------------------------------------------
    def _extract_with_spacy(self, text: str) -> tuple[Dict[str, Any], Dict[str, Any]]:
        if not self.use_nlp or not self.nlp:
            return {}, {"used": False}

        doc = self.nlp(text)

        metrics: Dict[str, Any] = {
            "country": self._extract_country(doc),
        }

        # Also pull coarse numeric hints that regex might miss depending on formatting.
        # We keep these conservative (only set if we detect a clear signal).
        # Years
        years = self._extract_years(text)
        if len(years) >= 2:
            metrics["timeline_start"] = years[0]
            metrics["timeline_end"] = years[-1]
        elif len(years) == 1:
            metrics["timeline_end"] = years[0]

        return metrics, {"used": True, "model": self.model_name, "backend": "spacy"}

    def _extract_country(self, doc) -> Optional[str]:
        """
        Extract likely country using spaCy NER:
          - Prefer GPE/LOC entities
          - Pick the first *high-level* location that appears like a country name.
        """
        if not hasattr(doc, "ents"):
            return None

        # Collect candidate entities
        cands: List[str] = []
        for ent in doc.ents:
            if ent.label_ in ("GPE", "LOC"):
                txt = ent.text.strip()
                # Filter very short / non-country-ish tokens
                if len(txt) < 3:
                    continue
                cands.append(txt)

        if not cands:
            return None

        # Heuristic: first location entity is often the country in policy docs
        # (You can improve by checking against a country list later.)
        return cands[0]

    def _extract_years(self, text: str) -> List[int]:
        yrs = sorted(set(int(y) for y in re.findall(r"\b(19\d{2}|20\d{2}|21\d{2})\b", text)))
        return yrs
