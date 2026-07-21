"""
Base Scraper class with common functionality.
Provides HTTP client, rate limiting, caching, and error handling.
"""
import httpx
import asyncio
import json
import os
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List
from bs4 import BeautifulSoup


class BaseScraper(ABC):
    """Base class for all data scrapers."""
    
    # Rate limiting settings
    REQUEST_DELAY = 1.0  # seconds between requests
    MAX_RETRIES = 3
    TIMEOUT = 30.0
    
    # Cache settings
    CACHE_DIR = Path(__file__).parent.parent / "data" / "cache"
    CACHE_DURATION = timedelta(hours=6)
    
    def __init__(self, use_cache: bool = True):
        self.use_cache = use_cache
        self.last_request_time = 0
        self._ensure_cache_dir()
        
        # Common headers to avoid blocking
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
        }
    
    def _ensure_cache_dir(self):
        """Create cache directory if it doesn't exist."""
        self.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    
    def _get_cache_path(self, key: str) -> Path:
        """Get cache file path for a given key."""
        safe_key = key.replace("/", "_").replace(":", "_").replace("?", "_")
        return self.CACHE_DIR / f"{self.source_name}_{safe_key}.json"
    
    def _get_cached_data(self, key: str) -> Optional[Dict[str, Any]]:
        """Retrieve data from cache if valid."""
        if not self.use_cache:
            return None
            
        cache_path = self._get_cache_path(key)
        if not cache_path.exists():
            return None
            
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                cached = json.load(f)
                
            cached_time = datetime.fromisoformat(cached.get("cached_at", "2000-01-01"))
            if datetime.now() - cached_time < self.CACHE_DURATION:
                return cached.get("data")
        except (json.JSONDecodeError, KeyError):
            pass
            
        return None
    
    def _save_to_cache(self, key: str, data: Dict[str, Any]):
        """Save data to cache."""
        cache_path = self._get_cache_path(key)
        cache_entry = {
            "cached_at": datetime.now().isoformat(),
            "data": data
        }
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(cache_entry, f, ensure_ascii=False, indent=2)
    
    async def _rate_limit(self):
        """Enforce rate limiting between requests."""
        now = asyncio.get_event_loop().time()
        elapsed = now - self.last_request_time
        if elapsed < self.REQUEST_DELAY:
            await asyncio.sleep(self.REQUEST_DELAY - elapsed)
        self.last_request_time = asyncio.get_event_loop().time()
    
    async def fetch_html(self, url: str) -> Optional[str]:
        """Fetch HTML content from URL with retries."""
        cached = self._get_cached_data(url)
        if cached:
            return cached.get("html")
        
        await self._rate_limit()
        
        for attempt in range(self.MAX_RETRIES):
            try:
                async with httpx.AsyncClient(
                    timeout=self.TIMEOUT,
                    follow_redirects=True
                ) as client:
                    response = await client.get(url, headers=self.headers)
                    response.raise_for_status()
                    html = response.text
                    
                    # Cache the HTML
                    self._save_to_cache(url, {"html": html})
                    return html
                    
            except httpx.HTTPError as e:
                print(f"[{self.source_name}] Attempt {attempt + 1} failed for {url}: {e}")
                if attempt < self.MAX_RETRIES - 1:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                    
        return None
    
    async def fetch_json(self, url: str) -> Optional[Dict[str, Any]]:
        """Fetch JSON data from URL."""
        cached = self._get_cached_data(url)
        if cached:
            return cached
        
        await self._rate_limit()
        
        for attempt in range(self.MAX_RETRIES):
            try:
                async with httpx.AsyncClient(
                    timeout=self.TIMEOUT,
                    follow_redirects=True
                ) as client:
                    response = await client.get(url, headers=self.headers)
                    response.raise_for_status()
                    data = response.json()
                    
                    self._save_to_cache(url, data)
                    return data
                    
            except (httpx.HTTPError, json.JSONDecodeError) as e:
                print(f"[{self.source_name}] Attempt {attempt + 1} failed for {url}: {e}")
                if attempt < self.MAX_RETRIES - 1:
                    await asyncio.sleep(2 ** attempt)
                    
        return None
    
    def parse_html(self, html: str) -> BeautifulSoup:
        """Parse HTML string into BeautifulSoup object."""
        return BeautifulSoup(html, "lxml")
    
    @property
    @abstractmethod
    def source_name(self) -> str:
        """Return the name of this data source."""
        pass
    
    @abstractmethod
    async def get_standings(self) -> List[Dict[str, Any]]:
        """Get current Champions League standings."""
        pass
    
    @abstractmethod
    async def get_team_stats(self, team_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed stats for a specific team."""
        pass
    
    @abstractmethod
    async def get_fixtures(self) -> List[Dict[str, Any]]:
        """Get upcoming fixtures."""
        pass
