"""
UEFA.com Scraper for Champions League data.
Extracts standings, fixtures, and team information from official UEFA website.
"""
import re
from typing import Dict, Any, List, Optional
from .base_scraper import BaseScraper


class UEFAScraper(BaseScraper):
    """Scraper for UEFA.com Champions League data."""
    
    BASE_URL = "https://www.uefa.com"
    UCL_BASE = f"{BASE_URL}/uefachampionsleague"
    
    # URLs
    STANDINGS_URL = f"{UCL_BASE}/standings/"
    FIXTURES_URL = f"{UCL_BASE}/fixtures-results/"
    TEAMS_URL = f"{UCL_BASE}/clubs/"
    STATS_URL = f"{UCL_BASE}/statistics/"
    
    @property
    def source_name(self) -> str:
        return "uefa"
    
    async def get_standings(self) -> List[Dict[str, Any]]:
        """Get current Champions League standings from UEFA.com."""
        standings = []
        
        html = await self.fetch_html(self.STANDINGS_URL)
        if not html:
            return self._get_cached_standings()
        
        soup = self.parse_html(html)
        
        # Parse the standings table
        table_rows = soup.select("table tbody tr, .standings-row, [class*='standing']")
        
        for row in table_rows:
            try:
                team_data = self._parse_standing_row(row)
                if team_data:
                    standings.append(team_data)
            except Exception as e:
                print(f"[UEFA] Error parsing row: {e}")
                continue
        
        # If we couldn't parse the dynamic content, use fallback data
        if not standings:
            standings = self._get_cached_standings()
            
        return standings
    
    def _parse_standing_row(self, row) -> Optional[Dict[str, Any]]:
        """Parse a single standings row."""
        cells = row.find_all(["td", "div"])
        if len(cells) < 5:
            return None
        
        # Try to extract team name
        team_link = row.select_one("a[href*='/clubs/']")
        team_name = team_link.get_text(strip=True) if team_link else None
        
        if not team_name:
            return None
            
        return {
            "name": team_name,
            "source": "uefa"
        }
    
    def _get_cached_standings(self) -> List[Dict[str, Any]]:
        """Return cached/static Champions League 2025/26 teams."""
        return [
            {"id": "arsenal", "name": "Arsenal", "short_name": "ARS", "country": "England"},
            {"id": "bayern-munich", "name": "Bayern Munich", "short_name": "BAY", "country": "Germany"},
            {"id": "real-madrid", "name": "Real Madrid", "short_name": "RMA", "country": "Spain"},
            {"id": "liverpool", "name": "Liverpool", "short_name": "LIV", "country": "England"},
            {"id": "tottenham", "name": "Tottenham Hotspur", "short_name": "TOT", "country": "England"},
            {"id": "psg", "name": "Paris Saint-Germain", "short_name": "PSG", "country": "France"},
            {"id": "newcastle", "name": "Newcastle United", "short_name": "NEW", "country": "England"},
            {"id": "chelsea", "name": "Chelsea", "short_name": "CHE", "country": "England"},
            {"id": "barcelona", "name": "Barcelona", "short_name": "BAR", "country": "Spain"},
            {"id": "sporting-cp", "name": "Sporting CP", "short_name": "SCP", "country": "Portugal"},
            {"id": "man-city", "name": "Manchester City", "short_name": "MCI", "country": "England"},
            {"id": "atletico-madrid", "name": "Atlético Madrid", "short_name": "ATM", "country": "Spain"},
            {"id": "atalanta", "name": "Atalanta", "short_name": "ATA", "country": "Italy"},
            {"id": "inter-milan", "name": "Inter Milan", "short_name": "INT", "country": "Italy"},
            {"id": "juventus", "name": "Juventus", "short_name": "JUV", "country": "Italy"},
            {"id": "dortmund", "name": "Borussia Dortmund", "short_name": "BVB", "country": "Germany"},
            {"id": "galatasaray", "name": "Galatasaray", "short_name": "GAL", "country": "Turkey"},
            {"id": "qarabag", "name": "FK Qarabag", "short_name": "QAR", "country": "Azerbaijan"},
            {"id": "marseille", "name": "Marseille", "short_name": "OM", "country": "France"},
            {"id": "leverkusen", "name": "Bayer Leverkusen", "short_name": "B04", "country": "Germany"},
            {"id": "monaco", "name": "AS Monaco", "short_name": "MON", "country": "France"},
            {"id": "psv", "name": "PSV Eindhoven", "short_name": "PSV", "country": "Netherlands"},
            {"id": "athletic-club", "name": "Athletic Club", "short_name": "ATH", "country": "Spain"},
            {"id": "olympiacos", "name": "Olympiacos", "short_name": "OLY", "country": "Greece"},
            {"id": "napoli", "name": "Napoli", "short_name": "NAP", "country": "Italy"},
            {"id": "copenhagen", "name": "FC Copenhagen", "short_name": "FCK", "country": "Denmark"},
            {"id": "club-brugge", "name": "Club Brugge", "short_name": "BRU", "country": "Belgium"},
            {"id": "bodo-glimt", "name": "Bodø/Glimt", "short_name": "BOD", "country": "Norway"},
            {"id": "benfica", "name": "Benfica", "short_name": "SLB", "country": "Portugal"},
            {"id": "pafos", "name": "Pafos", "short_name": "PAF", "country": "Cyprus"},
            {"id": "union-sg", "name": "Union St.-Gilloise", "short_name": "USG", "country": "Belgium"},
            {"id": "ajax", "name": "Ajax Amsterdam", "short_name": "AJA", "country": "Netherlands"},
            {"id": "frankfurt", "name": "Eintracht Frankfurt", "short_name": "SGE", "country": "Germany"},
            {"id": "slavia-prague", "name": "Slavia Prague", "short_name": "SLP", "country": "Czech Republic"},
            {"id": "celtic", "name": "Celtic", "short_name": "CEL", "country": "Scotland"},
            {"id": "feyenoord", "name": "Feyenoord", "short_name": "FEY", "country": "Netherlands"},
        ]
    
    async def get_team_stats(self, team_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed stats for a specific team from UEFA."""
        team_url = f"{self.TEAMS_URL}{team_id}/"
        html = await self.fetch_html(team_url)
        
        if not html:
            return None
            
        soup = self.parse_html(html)
        
        # Parse team page for stats
        stats = {
            "team_id": team_id,
            "source": "uefa"
        }
        
        # Try to find stats elements
        stat_elements = soup.select("[class*='stat'], [class*='Stat']")
        for elem in stat_elements:
            label = elem.select_one("[class*='label']")
            value = elem.select_one("[class*='value']")
            if label and value:
                stats[label.get_text(strip=True).lower().replace(" ", "_")] = value.get_text(strip=True)
        
        return stats
    
    async def get_fixtures(self) -> List[Dict[str, Any]]:
        """Get upcoming Champions League fixtures."""
        fixtures = []
        
        html = await self.fetch_html(self.FIXTURES_URL)
        if not html:
            return fixtures
            
        soup = self.parse_html(html)
        
        # Parse fixture cards
        match_cards = soup.select("[class*='match'], [class*='fixture']")
        
        for card in match_cards:
            try:
                fixture = self._parse_fixture_card(card)
                if fixture:
                    fixtures.append(fixture)
            except Exception as e:
                print(f"[UEFA] Error parsing fixture: {e}")
                continue
                
        return fixtures
    
    def _parse_fixture_card(self, card) -> Optional[Dict[str, Any]]:
        """Parse a fixture card element."""
        home_team = card.select_one("[class*='home'] a, [class*='team']:first-child")
        away_team = card.select_one("[class*='away'] a, [class*='team']:last-child")
        date_elem = card.select_one("[class*='date'], time")
        
        if not home_team or not away_team:
            return None
            
        return {
            "home_team": home_team.get_text(strip=True),
            "away_team": away_team.get_text(strip=True),
            "date": date_elem.get_text(strip=True) if date_elem else None,
            "source": "uefa"
        }
    
    async def get_team_squad(self, team_id: str) -> List[Dict[str, Any]]:
        """Get team squad/roster."""
        squad_url = f"{self.TEAMS_URL}{team_id}/squad/"
        html = await self.fetch_html(squad_url)
        
        if not html:
            return []
            
        soup = self.parse_html(html)
        players = []
        
        player_cards = soup.select("[class*='player-card'], [class*='squad-member']")
        
        for card in player_cards:
            name_elem = card.select_one("[class*='name']")
            position_elem = card.select_one("[class*='position']")
            number_elem = card.select_one("[class*='number']")
            
            if name_elem:
                players.append({
                    "name": name_elem.get_text(strip=True),
                    "position": position_elem.get_text(strip=True) if position_elem else "Unknown",
                    "number": number_elem.get_text(strip=True) if number_elem else None,
                    "team_id": team_id
                })
        
        return players
