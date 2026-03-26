"""
HYDRA INTEL - Parser Layer

Extracts structured fields from raw HTML/JSON responses.
Handles malformed HTML gracefully and cleans noisy text.
"""

import re
from typing import Any, Optional

from bs4 import BeautifulSoup, FeatureNotFound

from core.logger import get_logger

logger = get_logger(__name__)


class Parser:
    """Extract and clean data from raw web responses."""

    @staticmethod
    def parse_html(raw_html: str, parser: str = "html.parser") -> Optional[BeautifulSoup]:
        """Parse raw HTML into a BeautifulSoup tree.

        Falls back to html.parser if lxml is unavailable.

        Args:
            raw_html: Raw HTML string.
            parser: Parser backend to use.

        Returns:
            BeautifulSoup object or None on failure.
        """
        if not raw_html:
            return None
        try:
            return BeautifulSoup(raw_html, parser)
        except FeatureNotFound:
            logger.warning("Parser '%s' not available, falling back to html.parser", parser)
            return BeautifulSoup(raw_html, "html.parser")
        except Exception as e:
            logger.error("Failed to parse HTML: %s", e)
            return None

    @staticmethod
    def clean_text(text: str) -> str:
        """Remove noise from extracted text.

        Strips excess whitespace, control characters, and normalizes spacing.

        Args:
            text: Raw text to clean.

        Returns:
            Cleaned text string.
        """
        if not text:
            return ""
        # Remove control characters except newlines
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
        # Collapse whitespace
        text = re.sub(r"[ \t]+", " ", text)
        # Collapse multiple newlines
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @staticmethod
    def extract_text(soup: BeautifulSoup, selector: str) -> str:
        """Extract and clean text from a CSS selector match.

        Args:
            soup: Parsed HTML tree.
            selector: CSS selector string.

        Returns:
            Cleaned text or empty string.
        """
        element = soup.select_one(selector)
        if element:
            return Parser.clean_text(element.get_text())
        return ""

    @staticmethod
    def extract_all_text(soup: BeautifulSoup, selector: str) -> list[str]:
        """Extract text from all elements matching a CSS selector.

        Args:
            soup: Parsed HTML tree.
            selector: CSS selector string.

        Returns:
            List of cleaned text strings.
        """
        elements = soup.select(selector)
        return [Parser.clean_text(el.get_text()) for el in elements if el.get_text(strip=True)]

    @staticmethod
    def extract_links(soup: BeautifulSoup, selector: str = "a[href]") -> list[dict]:
        """Extract links (text + href) from matching elements.

        Args:
            soup: Parsed HTML tree.
            selector: CSS selector for link elements.

        Returns:
            List of dicts with 'text' and 'href' keys.
        """
        links = []
        for a in soup.select(selector):
            href = a.get("href", "")
            text = Parser.clean_text(a.get_text())
            if href:
                links.append({"text": text, "href": href})
        return links

    @staticmethod
    def safe_get(data: dict, *keys: str, default: Any = None) -> Any:
        """Safely traverse nested dicts/JSON.

        Args:
            data: Source dictionary.
            *keys: Sequence of keys to traverse.
            default: Value to return if any key is missing.

        Returns:
            Value at the nested key path, or default.
        """
        current = data
        for key in keys:
            if isinstance(current, dict):
                current = current.get(key, default)
            else:
                return default
        return current
