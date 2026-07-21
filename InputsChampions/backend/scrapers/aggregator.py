"""
Data Aggregator - Combines data from multiple scrapers.
Merges and normalizes data from UEFA, SofaScore, ESPN, etc.
"""
import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from .uefa_scraper import UEFAScraper
from .sofascore_scraper import SofaScoreScraper
from .espn_scraper import ESPNScraper


class DataAggregator:
    """Aggregates data from multiple football data sources."""
    
    CACHE_DIR = Path(__file__).parent.parent / "data" / "cache"
    
    def __init__(self, use_cache: bool = True):
        self.use_cache = use_cache
        self.uefa = UEFAScraper(use_cache=use_cache)
        self.sofascore = SofaScoreScraper(use_cache=use_cache)
        self.espn = ESPNScraper(use_cache=use_cache)
        
        self._ensure_cache_dir()
    
    def _ensure_cache_dir(self):
        """Create cache directory if needed."""
        self.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    
    async def get_all_teams(self) -> List[Dict[str, Any]]:
        """Get all Champions League teams with aggregated data."""
        # Start with UEFA's team list as base
        teams = self.uefa._get_cached_standings()
        
        # Enrich with data from other sources in parallel
        enriched_teams = []
        
        for team in teams:
            team_id = team["id"]
            enriched = await self._enrich_team_data(team)
            enriched_teams.append(enriched)
        
        # Sort by overall score
        enriched_teams.sort(
            key=lambda t: t.get("analysis", {}).get("overall_score", 0),
            reverse=True
        )
        
        return enriched_teams
    
    async def _enrich_team_data(self, team: Dict[str, Any]) -> Dict[str, Any]:
        """Enrich a single team with data from all sources."""
        team_id = team["id"]
        
        # Gather data from all sources in parallel
        sofascore_stats, espn_injuries, sofascore_form, espn_form = await asyncio.gather(
            self.sofascore.get_team_stats(team_id),
            self.espn.get_team_injuries(team_id),
            self.sofascore.get_team_form(team_id),
            self.espn.get_team_form(team_id),
            return_exceptions=True
        )
        
        # Handle exceptions
        if isinstance(sofascore_stats, Exception):
            sofascore_stats = None
        if isinstance(espn_injuries, Exception):
            espn_injuries = []
        if isinstance(sofascore_form, Exception):
            sofascore_form = {}
        if isinstance(espn_form, Exception):
            espn_form = {}
        
        # Merge form data (prefer SofaScore)
        form = sofascore_form if sofascore_form.get("form_string") else espn_form
        
        # Build enriched team object
        enriched = {
            **team,
            "stats": sofascore_stats or {},
            "injuries": espn_injuries or [],
            "form": form,
            "last_updated": datetime.now().isoformat()
        }
        
        return enriched
    
    async def get_team_full_analysis(self, team_id: str) -> Optional[Dict[str, Any]]:
        """Get complete analysis for a single team."""
        # Find base team data
        teams = self.uefa._get_cached_standings()
        team = next((t for t in teams if t["id"] == team_id), None)
        
        if not team:
            return None
        
        # Gather all data
        (
            sofascore_stats,
            sofascore_form,
            sofascore_injuries,
            espn_injuries,
            player_ratings
        ) = await asyncio.gather(
            self.sofascore.get_team_stats(team_id),
            self.sofascore.get_team_form(team_id),
            self.sofascore.get_team_injuries(team_id),
            self.espn.get_team_injuries(team_id),
            self.sofascore.get_player_ratings(team_id),
            return_exceptions=True
        )
        
        # Handle exceptions
        stats = sofascore_stats if not isinstance(sofascore_stats, Exception) else {}
        form = sofascore_form if not isinstance(sofascore_form, Exception) else {}
        
        # Merge injuries from both sources
        injuries = []
        if not isinstance(sofascore_injuries, Exception):
            injuries.extend(sofascore_injuries)
        if not isinstance(espn_injuries, Exception):
            # Add ESPN injuries not already in list
            existing_names = {i.get("player_name", "").lower() for i in injuries}
            for inj in espn_injuries:
                if inj.get("player_name", "").lower() not in existing_names:
                    injuries.append(inj)
        
        ratings = player_ratings if not isinstance(player_ratings, Exception) else []
        
        return {
            **team,
            "stats": stats,
            "form": form,
            "injuries": injuries,
            "player_ratings": ratings,
            "injury_count": len(injuries),
            "last_updated": datetime.now().isoformat()
        }
    
    async def get_all_fixtures(self) -> List[Dict[str, Any]]:
        """Get upcoming fixtures from all sources."""
        uefa_fixtures, sofascore_fixtures = await asyncio.gather(
            self.uefa.get_fixtures(),
            self.sofascore.get_fixtures(),
            return_exceptions=True
        )
        
        # Prefer SofaScore fixtures (more detailed)
        if isinstance(sofascore_fixtures, Exception) or not sofascore_fixtures:
            return uefa_fixtures if not isinstance(uefa_fixtures, Exception) else []
        
        return sofascore_fixtures
    
    async def get_standings(self) -> List[Dict[str, Any]]:
        """Get current UCL standings."""
        sofascore_standings, espn_standings = await asyncio.gather(
            self.sofascore.get_standings(),
            self.espn.get_standings(),
            return_exceptions=True
        )
        
        # Prefer SofaScore standings
        if isinstance(sofascore_standings, Exception) or not sofascore_standings:
            return espn_standings if not isinstance(espn_standings, Exception) else []
        
        return sofascore_standings
    
    async def refresh_all_data(self) -> Dict[str, Any]:
        """Refresh all cached data from sources."""
        # Clear cache
        for cache_file in self.CACHE_DIR.glob("*.json"):
            cache_file.unlink()
        
        # Fetch fresh data
        teams = await self.get_all_teams()
        standings = await self.get_standings()
        fixtures = await self.get_all_fixtures()
        
        # Save aggregated data
        aggregated = {
            "teams": teams,
            "standings": standings,
            "fixtures": fixtures,
            "last_updated": datetime.now().isoformat()
        }
        
        with open(self.CACHE_DIR / "aggregated_data.json", "w", encoding="utf-8") as f:
            json.dump(aggregated, f, ensure_ascii=False, indent=2)
        
        return {
            "status": "success",
            "teams_count": len(teams),
            "fixtures_count": len(fixtures),
            "last_updated": aggregated["last_updated"]
        }
    
    def get_cached_aggregated_data(self) -> Optional[Dict[str, Any]]:
        """Get previously cached aggregated data."""
        cache_file = self.CACHE_DIR / "aggregated_data.json"
        if not cache_file.exists():
            return None
        
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return None
