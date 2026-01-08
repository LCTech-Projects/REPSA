"""
Modern NLP-based policy metric extraction using transformer models.

This module provides an enhanced extraction method using transformer-based NLP
models, which can understand context, handle variations in phrasing, and extract
implicit information better than regex patterns.

Options:
1. Local models (spaCy with transformers, or HuggingFace models)
2. API-based (OpenAI GPT, Anthropic Claude)
3. Hybrid approach (regex first, NLP fallback)
"""

import re
from typing import Dict, Any, Optional
import os


class TransformerNLPExtractor:
    """
    Transformer-based NLP extractor for policy documents.
    
    Supports multiple backends:
    - Local models (spaCy transformers, HuggingFace)
    - API-based (OpenAI, Anthropic)
    """
    
    def __init__(self, backend: str = "spacy", model_name: Optional[str] = None):
        """
        Initialize NLP extractor.
        
        Parameters:
        -----------
        backend : str
            Backend to use: "spacy", "openai", "anthropic", or "huggingface"
        model_name : str, optional
            Specific model name (e.g., "en_core_web_trf" for spaCy)
        """
        self.backend = backend
        self.model_name = model_name
        self.model = None
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize the NLP model based on backend."""
        if self.backend == "spacy":
            try:
                import spacy
                # Try to load transformer-based model
                if self.model_name:
                    try:
                        self.model = spacy.load(self.model_name)
                    except Exception as e:
                        # Handle Python 3.14 compatibility issues with spaCy
                        if "REGEX" in str(e) or "pydantic" in str(e).lower():
                            print(f"⚠️  spaCy compatibility issue with Python 3.14: {e}")
                            print("   Trying smaller model as fallback...")
                            try:
                                self.model = spacy.load("en_core_web_sm")
                            except Exception as e2:
                                print(f"⚠️  Could not load spaCy model: {e2}")
                                print("   Falling back to regex-only extraction.")
                                self.model = None
                        else:
                            raise
                else:
                    # Try transformer model first, fallback to regular
                    try:
                        self.model = spacy.load("en_core_web_trf")
                    except Exception as e:
                        # Handle Python 3.14 compatibility issues
                        if "REGEX" in str(e) or "pydantic" in str(e).lower():
                            print(f"⚠️  spaCy transformer model incompatible with Python 3.14")
                            print("   Trying smaller model as fallback...")
                            try:
                                self.model = spacy.load("en_core_web_sm")
                            except OSError:
                                print("⚠️  spaCy model not found. Install with: python -m spacy download en_core_web_sm")
                                self.model = None
                            except Exception as e2:
                                print(f"⚠️  Could not load spaCy model: {e2}")
                                self.model = None
                        else:
                            # For non-Python 3.14 errors, try smaller model
                            try:
                                self.model = spacy.load("en_core_web_sm")
                            except OSError:
                                print("⚠️  spaCy model not found. Install with: python -m spacy download en_core_web_sm")
                                self.model = None
                            except Exception as e2:
                                print(f"⚠️  Could not load spaCy model: {e2}")
                                self.model = None
            except ImportError:
                print("⚠️  spaCy not installed. Install with: pip install spacy")
                self.model = None
            except Exception as e:
                # Catch any other unexpected errors
                print(f"⚠️  Unexpected error initializing spaCy: {e}")
                print("   Falling back to regex-only extraction.")
                self.model = None
        
        elif self.backend == "huggingface":
            try:
                from transformers import pipeline
                self.model = pipeline(
                    "text2text-generation",
                    model=model_name or "google/flan-t5-base",
                    device=-1  # CPU
                )
            except ImportError:
                print("⚠️  transformers not installed. Install with: pip install transformers")
                self.model = None
        
        elif self.backend in ["openai", "anthropic"]:
            # API-based, no local model needed
            self.model = True
            api_key_env = "OPENAI_API_KEY" if self.backend == "openai" else "ANTHROPIC_API_KEY"
            if not os.environ.get(api_key_env):
                print(f"⚠️  {api_key_env} not set. API calls will fail.")
    
    def extract_with_nlp(self, policy_text: str) -> Dict[str, Any]:
        """
        Extract metrics using transformer-based NLP.
        
        Parameters:
        -----------
        policy_text : str
            Policy document text
        
        Returns:
        --------
        dict
            Extracted metrics
        """
        if not self.model:
            return {}
        
        if self.backend == "spacy":
            return self._extract_with_spacy(policy_text)
        elif self.backend == "openai":
            return self._extract_with_openai(policy_text)
        elif self.backend == "anthropic":
            return self._extract_with_anthropic(policy_text)
        elif self.backend == "huggingface":
            return self._extract_with_huggingface(policy_text)
        else:
            return {}
    
    def _extract_with_spacy(self, text: str) -> Dict[str, Any]:
        """Extract using spaCy transformer model."""
        if not self.model:
            return {}
        
        doc = self.model(text)
        metrics = {}
        
        # Use Named Entity Recognition (NER) and dependency parsing
        # Look for quantities, percentages, and dates
        for ent in doc.ents:
            if ent.label_ == "MONEY":
                # Extract investment amounts
                value = self._parse_money(ent.text)
                if value:
                    metrics['investment_amount'] = value
            
            elif ent.label_ == "PERCENT":
                # Extract percentages
                value = self._parse_percent(ent.text)
                # Use context to determine what the percentage refers to
                context = self._get_context(ent, doc)
                if "renewable" in context.lower():
                    metrics['renewable_target'] = value
                elif "access" in context.lower():
                    metrics['energy_access_target'] = value
                elif "poverty" in context.lower():
                    metrics['energy_poverty_target'] = value
                elif "co2" in context.lower() or "carbon" in context.lower():
                    metrics['co2_reduction_target'] = value
                elif "cooking" in context.lower():
                    metrics['clean_cooking_target'] = value
            
            elif ent.label_ == "DATE":
                # Extract years
                years = self._extract_years(ent.text)
                if years:
                    if 'timeline_start' not in metrics:
                        metrics['timeline_start'] = min(years)
                    metrics['timeline_end'] = max(years)
        
        # Use dependency parsing to find relationships
        # e.g., "solar capacity of 20 GW"
        for token in doc:
            if token.text.lower() in ["solar", "wind"]:
                # Look for quantities in the dependency tree
                for child in token.children:
                    if child.dep_ == "amod" or child.dep_ == "nmod":
                        # Check for numbers and units
                        num_value = self._extract_capacity(child.text, token.text.lower())
                        if num_value:
                            if "solar" in token.text.lower():
                                metrics['solar_target'] = num_value
                            elif "wind" in token.text.lower():
                                metrics['wind_target'] = num_value
        
        return metrics
    
    def _extract_with_openai(self, text: str) -> Dict[str, Any]:
        """Extract using OpenAI GPT API."""
        try:
            import openai
            
            prompt = f"""Extract the following metrics from this energy policy document. Return only a JSON object with these keys (use null if not found):
- renewable_target (percentage, float)
- investment_amount (billions USD, float)
- timeline_start (year, int)
- timeline_end (year, int)
- solar_target (GW, float)
- wind_target (GW, float)
- energy_access_target (percentage, float)
- energy_poverty_target (percentage, float)
- co2_reduction_target (percentage, float)
- clean_cooking_target (percentage, float)
- population_growth_rate (percentage per year, float)

Policy document:
{text[:4000]}  # Limit to avoid token limits

Return only valid JSON, no other text:"""

            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a data extraction assistant. Extract metrics from policy documents and return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=500
            )
            
            import json
            result = json.loads(response.choices[0].message.content)
            return result
        
        except Exception as e:
            print(f"⚠️  OpenAI extraction failed: {e}")
            return {}
    
    def _extract_with_anthropic(self, text: str) -> Dict[str, Any]:
        """Extract using Anthropic Claude API."""
        try:
            import anthropic
            
            client = anthropic.Anthropic()
            
            message = client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=500,
                messages=[{
                    "role": "user",
                    "content": f"""Extract energy policy metrics from this document and return JSON:
{text[:4000]}

Return JSON with: renewable_target, investment_amount, timeline_start, timeline_end, solar_target, wind_target, energy_access_target, energy_poverty_target, co2_reduction_target, clean_cooking_target, population_growth_rate"""
                }]
            )
            
            import json
            result = json.loads(message.content[0].text)
            return result
        
        except Exception as e:
            print(f"⚠️  Anthropic extraction failed: {e}")
            return {}
    
    def _extract_with_huggingface(self, text: str) -> Dict[str, Any]:
        """Extract using HuggingFace transformers."""
        # This would require fine-tuning or using a question-answering model
        # For now, return empty dict
        return {}
    
    def _parse_money(self, text: str) -> Optional[float]:
        """Parse money amounts to billions USD."""
        # Extract number and unit
        match = re.search(r'[\$]?(\d+(?:\.\d+)?)\s*(billion|million|b|m)', text.lower())
        if match:
            amount = float(match.group(1))
            unit = match.group(2)
            if unit in ['million', 'm']:
                return amount / 1000
            return amount
        return None
    
    def _parse_percent(self, text: str) -> Optional[float]:
        """Parse percentage values."""
        match = re.search(r'(\d+(?:\.\d+)?)', text)
        if match:
            return float(match.group(1))
        return None
    
    def _extract_years(self, text: str) -> list:
        """Extract years from date strings."""
        years = re.findall(r'\b(19|20)\d{2}\b', text)
        return [int(y) for y in years]
    
    def _extract_capacity(self, text: str, energy_type: str) -> Optional[float]:
        """Extract capacity values (GW)."""
        match = re.search(r'(\d+(?:\.\d+)?)\s*(?:gw|gigawatt)', text.lower())
        if match:
            return float(match.group(1))
        return None
    
    def _get_context(self, entity, doc, window: int = 10) -> str:
        """Get context around an entity."""
        start = max(0, entity.start - window)
        end = min(len(doc), entity.end + window)
        return doc[start:end].text


class HybridExtractor:
    """
    Hybrid extractor that combines regex (fast) with NLP (accurate).
    
    Strategy:
    1. Try regex first (fast, deterministic)
    2. If regex misses metrics, use NLP as fallback
    3. Merge results, preferring NLP for conflicts
    """
    
    def __init__(self, nlp_backend: str = "spacy", use_nlp: bool = True):
        """
        Initialize hybrid extractor.
        
        Parameters:
        -----------
        nlp_backend : str
            NLP backend to use if regex fails
        use_nlp : bool
            Whether to use NLP fallback (set False for regex-only)
        """
        self.use_nlp = use_nlp
        self.nlp_extractor = TransformerNLPExtractor(backend=nlp_backend) if use_nlp else None
    
    def extract(self, policy_text: str, regex_extractor) -> Dict[str, Any]:
        """
        Extract metrics using hybrid approach.
        
        Parameters:
        -----------
        policy_text : str
            Policy document text
        regex_extractor : callable
            Function that extracts metrics using regex (from PolicyAnalyzer)
        
        Returns:
        --------
        dict
            Merged metrics from both approaches
        """
        # Step 1: Try regex first (fast)
        regex_metrics = regex_extractor(policy_text)
        
        # Step 2: Check if regex missed important metrics
        important_metrics = [
            'renewable_target', 'investment_amount', 
            'energy_access_target', 'co2_reduction_target'
        ]
        missing_important = [
            key for key in important_metrics 
            if regex_metrics.get(key) is None
        ]
        
        # Step 3: Use NLP if regex missed important metrics
        nlp_metrics = {}
        if self.use_nlp and missing_important and self.nlp_extractor:
            try:
                nlp_metrics = self.nlp_extractor.extract_with_nlp(policy_text)
            except Exception as e:
                print(f"⚠️  NLP extraction failed: {e}")
        
        # Step 4: Merge results (NLP takes precedence for conflicts)
        merged = {**regex_metrics, **nlp_metrics}
        
        return merged

