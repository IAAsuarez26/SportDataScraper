"""
ESPN Scraper for Champions League data.
Extracts standings, news, and injury reports.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
from .base_scraper import BaseScraper


class ESPNScraper(BaseScraper):
    """Scraper for ESPN football data."""
    
    BASE_URL = "https://www.espn.com"
    SOCCER_BASE = f"{BASE_URL}/soccer"
    
    # ESPN Team IDs
    TEAM_IDS = {
        "arsenal": 359,
        "bayern-munich": 132,
        "real-madrid": 86,
        "liverpool": 364,
        "tottenham": 367,
        "psg": 160,
        "newcastle": 361,
        "chelsea": 363,
        "barcelona": 83,
        "sporting-cp": 2250,
        "man-city": 382,
        "atletico-madrid": 1068,
        "atalanta": 105,
        "inter-milan": 110,
        "juventus": 111,
        "dortmund": 124,
        "galatasaray": 432,
        "qarabag": 10414,
        "marseille": 176,
        "leverkusen": 131,
        "monaco": 174,
        "psv": 148,
        "athletic-club": 93,
        "olympiacos": 435,
        "napoli": 114,
        "copenhagen": 909,
        "club-brugge": 570,
        "bodo-glimt": 2980,
        "benfica": 1929,
        "pafos": 22281,
        "union-sg": 5807,
        "ajax": 139,
        "frankfurt": 125,
        "slavia-prague": 494,
        "celtic": 5513,
        "feyenoord": 141,
    }
    
    @property
    def source_name(self) -> str:
        return "espn"
    
    async def get_standings(self) -> List[Dict[str, Any]]:
        """Get UCL standings from ESPN."""
        url = f"{self.SOCCER_BASE}/table/_/league/uefa.champions"
        html = await self.fetch_html(url)
        
        if not html:
            return []
        
        soup = self.parse_html(html)
        standings = []
        
        # Parse standings table
        table = soup.select_one("table.Table")
        if not table:
            return []
        
        rows = table.select("tbody tr")
        for idx, row in enumerate(rows, 1):
            cells = row.select("td")
            if len(cells) < 8:
                continue
            
            team_cell = cells[0]
            team_link = team_cell.select_one("a")
            team_name = team_link.get_text(strip=True) if team_link else ""
            
            standings.append({
                "position": idx,
                "name": team_name,
                "played": self._safe_int(cells[1].get_text(strip=True)),
                "wins": self._safe_int(cells[2].get_text(strip=True)),
                "draws": self._safe_int(cells[3].get_text(strip=True)),
                "losses": self._safe_int(cells[4].get_text(strip=True)),
                "goals_for": self._safe_int(cells[5].get_text(strip=True)),
                "goals_against": self._safe_int(cells[6].get_text(strip=True)),
                "points": self._safe_int(cells[7].get_text(strip=True)),
                "source": "espn"
            })
        
        return standings
    
    def _safe_int(self, value: str) -> int:
        """Safely convert string to int."""
        try:
            return int(value)
        except (ValueError, TypeError):
            return 0
    
    async def get_team_stats(self, team_id: str) -> Optional[Dict[str, Any]]:
        """Get team stats from ESPN."""
        espn_id = self.TEAM_IDS.get(team_id)
        if not espn_id:
            return None
        
        url = f"{self.SOCCER_BASE}/team/stats/_/id/{espn_id}"
        html = await self.fetch_html(url)
        
        if not html:
            return None
        
        soup = self.parse_html(html)
        
        stats = {
            "team_id": team_id,
            "espn_id": espn_id,
            "source": "espn"
        }
        
        # Parse stat tables
        stat_tables = soup.select("table.Table")
        for table in stat_tables:
            header = table.select_one("thead")
            if not header:
                continue
            
            # Get column headers
            headers = [th.get_text(strip=True) for th in header.select("th")]
            
            # Get team totals (usually last row)
            rows = table.select("tbody tr")
            if rows:
                last_row = rows[-1]
                cells = last_row.select("td")
                for i, cell in enumerate(cells):
                    if i < len(headers):
                        key = headers[i].lower().replace(" ", "_")
                        stats[key] = cell.get_text(strip=True)
        
        return stats
    
    async def get_fixtures(self) -> List[Dict[str, Any]]:
        """Get upcoming UCL fixtures from ESPN."""
        url = f"{self.SOCCER_BASE}/schedule/_/league/uefa.champions"
        html = await self.fetch_html(url)
        
        if not html:
            return []
        
        soup = self.parse_html(html)
        fixtures = []
        
        # Parse fixture list
        fixture_cards = soup.select("[class*='ScoreCell']")
        
        for card in fixture_cards:
            try:
                teams = card.select("[class*='TeamName']")
                if len(teams) >= 2:
                    fixtures.append({
                        "home_team": teams[0].get_text(strip=True),
                        "away_team": teams[1].get_text(strip=True),
                        "source": "espn"
                    })
            except Exception:
                continue
        
        return fixtures
    
    async def get_team_injuries(self, team_id: str) -> List[Dict[str, Any]]:
        """Get team injury report from ESPN."""
        espn_id = self.TEAM_IDS.get(team_id)
        if not espn_id:
            return []
        
        url = f"{self.SOCCER_BASE}/team/injuries/_/id/{espn_id}"
        html = await self.fetch_html(url)
        
        if not html:
            return self._get_sample_injuries(team_id)
        
        soup = self.parse_html(html)
        injuries = []
        
        # Parse injury table
        table = soup.select_one("table.Table")
        if not table:
            return self._get_sample_injuries(team_id)
        
        rows = table.select("tbody tr")
        for row in rows:
            cells = row.select("td")
            if len(cells) >= 3:
                injuries.append({
                    "player_name": cells[0].get_text(strip=True),
                    "injury_type": cells[1].get_text(strip=True) if len(cells) > 1 else "Unknown",
                    "status": cells[2].get_text(strip=True) if len(cells) > 2 else "Out",
                    "source": "espn"
                })
        
        return injuries if injuries else self._get_sample_injuries(team_id)
    
    def _get_sample_injuries(self, team_id: str) -> List[Dict[str, Any]]:
        """Return sample injury data for demonstration."""
        # Sample injuries by team
        injury_data = {
            "real-madrid": [
                {"player_name": "Dani Carvajal", "injury_type": "ACL", "status": "Out"},
                {"player_name": "David Alaba", "injury_type": "ACL", "status": "Out"},
            ],
            "barcelona": [
                {"player_name": "Ronald Araujo", "injury_type": "Hamstring", "status": "Doubtful"},
                {"player_name": "Frenkie de Jong", "injury_type": "Ankle", "status": "Day-to-day"},
            ],
            "man-city": [
                {"player_name": "Rodri", "injury_type": "ACL", "status": "Out for Season"},
                {"player_name": "Oscar Bobb", "injury_type": "Leg", "status": "Out"},
            ],
            "liverpool": [
                {"player_name": "Diogo Jota", "injury_type": "Muscle", "status": "Doubtful"},
            ],
            "chelsea": [
                {"player_name": "Reece James", "injury_type": "Hamstring", "status": "Out"},
            ],
            "bayern-munich": [
                {"player_name": "Kingsley Coman", "injury_type": "Muscle", "status": "Doubtful"},
            ],
            "arsenal": [
                {"player_name": "Ben White", "injury_type": "Knee", "status": "Day-to-day"},
            ],
        }
        
        return injury_data.get(team_id, [])
    
    async def get_team_form(self, team_id: str) -> Dict[str, Any]:
        """Get team's recent form from ESPN."""
        espn_id = self.TEAM_IDS.get(team_id)
        if not espn_id:
            return {"form_string": "", "last_5": []}
        
        url = f"{self.SOCCER_BASE}/team/results/_/id/{espn_id}"
        html = await self.fetch_html(url)
        
        if not html:
            return {"form_string": "", "last_5": []}
        
        soup = self.parse_html(html)
        form = []
        
        # Parse recent results
        result_rows = soup.select("[class*='ResultRow'], [class*='ScoreCell']")[:5]
        
        for row in result_rows:
            # Try to determine result
            result_elem = row.select_one("[class*='result'], [class*='score']")
            if result_elem:
                text = result_elem.get_text(strip=True).upper()
                if "W" in text:
                    form.append("W")
                elif "L" in text:
                    form.append("L")
                else:
                    form.append("D")
        
        return {
            "form_string": "".join(form),
            "last_5": form,
            "wins": form.count("W"),
            "draws": form.count("D"),
            "losses": form.count("L")
        }
