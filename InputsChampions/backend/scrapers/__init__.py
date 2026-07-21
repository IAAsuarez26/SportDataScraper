"""
Champions League Data Scrapers Module.
Multi-source data collection from UEFA.com, SofaScore, ESPN, and more.
"""

from .base_scraper import BaseScraper
from .uefa_scraper import UEFAScraper
from .sofascore_scraper import SofaScoreScraper
from .espn_scraper import ESPNScraper
from .aggregator import DataAggregator

__all__ = [
    "BaseScraper",
    "UEFAScraper", 
    "SofaScoreScraper",
    "ESPNScraper",
    "DataAggregator"
]
