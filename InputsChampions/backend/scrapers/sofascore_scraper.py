"""
SofaScore Scraper for advanced football statistics.
Extracts detailed stats, xG, player ratings, and form data.
"""
from typing import Dict, Any, List, Optional
from .base_scraper import BaseScraper


class SofaScoreScraper(BaseScraper):
    """Scraper for SofaScore football statistics."""
    
    BASE_URL = "https://www.sofascore.com"
    API_URL = "https://api.sofascore.com/api/v1"
    UCL_TOURNAMENT_ID = 7
    UCL_SEASON_ID = 61644  # 2025/26 season - may need adjustment
    
    # Team ID mappings for SofaScore
    TEAM_IDS = {
        "real-madrid": 2829,
        "barcelona": 2817,
        "bayern-munich": 2672,
        "liverpool": 44,
        "man-city": 17,
        "arsenal": 42,
        "chelsea": 38,
        "psg": 1644,
        "juventus": 2687,
        "inter-milan": 2697,
        "atletico-madrid": 2836,
        "dortmund": 2673,
        "napoli": 2714,
        "leverkusen": 2681,
        "tottenham": 33,
        "newcastle": 39,
        "atalanta": 2686,
        "benfica": 2233,
        "sporting-cp": 2227,
        "ajax": 194,
        "psv": 203,
        "club-brugge": 2887,
        "celtic": 5513,
        "feyenoord": 196,
        "monaco": 1641,
        "marseille": 1635,
        "frankfurt": 2675,
        "galatasaray": 3023,
        "olympiacos": 3010,
        "copenhagen": 1945,
        "slavia-prague": 2960,
        "bodo-glimt": 4496,
        "union-sg": 6671,
        "qarabag": 5962,
        "athletic-club": 2825,
        "pafos": 84817,
    }
    
    @property
    def source_name(self) -> str:
        return "sofascore"
    
    async def get_standings(self) -> List[Dict[str, Any]]:
        """Get UCL standings from SofaScore API."""
        url = f"{self.API_URL}/unique-tournament/{self.UCL_TOURNAMENT_ID}/season/{self.UCL_SEASON_ID}/standings/total"
        
        data = await self.fetch_json(url)
        if not data:
            return []
        
        standings = []
        for group in data.get("standings", []):
            for row in group.get("rows", []):
                team = row.get("team", {})
                standings.append({
                    "id": team.get("id"),
                    "name": team.get("name"),
                    "short_name": team.get("shortName"),
                    "position": row.get("position"),
                    "played": row.get("matches"),
                    "wins": row.get("wins"),
                    "draws": row.get("draws"),
                    "losses": row.get("losses"),
                    "goals_for": row.get("scoresFor"),
                    "goals_against": row.get("scoresAgainst"),
                    "points": row.get("points"),
                    "source": "sofascore"
                })
        
        return standings
    
    async def get_team_stats(self, team_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed team statistics from SofaScore."""
        sofa_id = self.TEAM_IDS.get(team_id)
        if not sofa_id:
            return None
        
        # Get team overall stats
        stats_url = f"{self.API_URL}/team/{sofa_id}/unique-tournament/{self.UCL_TOURNAMENT_ID}/season/{self.UCL_SEASON_ID}/statistics/overall"
        
        data = await self.fetch_json(stats_url)
        if not data:
            return self._get_estimated_stats(team_id)
        
        stats = data.get("statistics", {})
        
        return {
            "team_id": team_id,
            "sofascore_id": sofa_id,
            # Attack
            "goals": stats.get("goalsScored", 0),
            "xg": stats.get("expectedGoals", 0),
            "shots_total": stats.get("shotsTotal", 0),
            "shots_on_target": stats.get("shotsOnTarget", 0),
            "big_chances": stats.get("bigChances", 0),
            # Defense
            "goals_conceded": stats.get("goalsConceded", 0),
            "xga": stats.get("expectedGoalsAgainst", 0),
            "clean_sheets": stats.get("cleanSheets", 0),
            "tackles_won": stats.get("tacklesWon", 0),
            "interceptions": stats.get("interceptions", 0),
            # Possession
            "possession_avg": stats.get("averagePossession", 50),
            "pass_accuracy": stats.get("passAccuracy", 80),
            "passes_per_game": stats.get("passesPerGame", 400),
            # Discipline
            "yellow_cards": stats.get("yellowCards", 0),
            "red_cards": stats.get("redCards", 0),
            "fouls": stats.get("fouls", 0),
            "source": "sofascore"
        }
    
    def _get_estimated_stats(self, team_id: str) -> Dict[str, Any]:
        """Return estimated stats based on team tier."""
        # Tier 1 teams (top clubs)
        tier1 = ["real-madrid", "barcelona", "bayern-munich", "liverpool", "man-city", "arsenal", "psg"]
        # Tier 2 teams
        tier2 = ["chelsea", "juventus", "inter-milan", "atletico-madrid", "dortmund", "napoli", "leverkusen", 
                 "tottenham", "newcastle", "atalanta", "benfica", "sporting-cp"]
        
        if team_id in tier1:
            return {
                "team_id": team_id,
                "goals": 12, "xg": 11.5, "goals_conceded": 4, "xga": 5.0,
                "possession_avg": 58, "pass_accuracy": 88, "clean_sheets": 3,
                "shots_on_target": 28, "source": "estimated"
            }
        elif team_id in tier2:
            return {
                "team_id": team_id,
                "goals": 8, "xg": 7.5, "goals_conceded": 6, "xga": 6.5,
                "possession_avg": 52, "pass_accuracy": 84, "clean_sheets": 2,
                "shots_on_target": 20, "source": "estimated"
            }
        else:
            return {
                "team_id": team_id,
                "goals": 5, "xg": 5.0, "goals_conceded": 9, "xga": 8.5,
                "possession_avg": 45, "pass_accuracy": 78, "clean_sheets": 1,
                "shots_on_target": 14, "source": "estimated"
            }
    
    async def get_team_form(self, team_id: str) -> Dict[str, Any]:
        """Get team's recent form (last 5 matches)."""
        sofa_id = self.TEAM_IDS.get(team_id)
        if not sofa_id:
            return {"last_5": [], "form_string": ""}
        
        url = f"{self.API_URL}/team/{sofa_id}/events/last/0"
        data = await self.fetch_json(url)
        
        if not data:
            return {"last_5": [], "form_string": ""}
        
        events = data.get("events", [])[:5]
        form = []
        form_string = ""
        
        for event in events:
            home_team = event.get("homeTeam", {})
            away_team = event.get("awayTeam", {})
            home_score = event.get("homeScore", {}).get("current", 0)
            away_score = event.get("awayScore", {}).get("current", 0)
            
            is_home = home_team.get("id") == sofa_id
            team_score = home_score if is_home else away_score
            opponent_score = away_score if is_home else home_score
            opponent_name = away_team.get("name") if is_home else home_team.get("name")
            
            if team_score > opponent_score:
                result = "W"
            elif team_score < opponent_score:
                result = "L"
            else:
                result = "D"
            
            form.append({
                "result": result,
                "score": f"{team_score}-{opponent_score}",
                "opponent": opponent_name,
                "is_home": is_home
            })
            form_string += result
        
        return {
            "last_5": form,
            "form_string": form_string,
            "wins": form_string.count("W"),
            "draws": form_string.count("D"),
            "losses": form_string.count("L")
        }
    
    async def get_fixtures(self) -> List[Dict[str, Any]]:
        """Get upcoming UCL fixtures."""
        url = f"{self.API_URL}/unique-tournament/{self.UCL_TOURNAMENT_ID}/season/{self.UCL_SEASON_ID}/events/next/0"
        
        data = await self.fetch_json(url)
        if not data:
            return []
        
        fixtures = []
        for event in data.get("events", []):
            fixtures.append({
                "id": event.get("id"),
                "home_team": event.get("homeTeam", {}).get("name"),
                "away_team": event.get("awayTeam", {}).get("name"),
                "home_team_id": event.get("homeTeam", {}).get("id"),
                "away_team_id": event.get("awayTeam", {}).get("id"),
                "start_timestamp": event.get("startTimestamp"),
                "round": event.get("roundInfo", {}).get("round"),
                "source": "sofascore"
            })
        
        return fixtures
    
    async def get_team_injuries(self, team_id: str) -> List[Dict[str, Any]]:
        """Get team injury list."""
        sofa_id = self.TEAM_IDS.get(team_id)
        if not sofa_id:
            return []
        
        url = f"{self.API_URL}/team/{sofa_id}/player-injuries"
        data = await self.fetch_json(url)
        
        if not data:
            return []
        
        injuries = []
        for injury in data.get("playerInjuries", []):
            player = injury.get("player", {})
            injuries.append({
                "player_name": player.get("name"),
                "player_id": player.get("id"),
                "injury_type": injury.get("injuryType"),
                "status": injury.get("status"),
                "expected_return": injury.get("expectedReturn"),
                "source": "sofascore"
            })
        
        return injuries
    
    async def get_player_ratings(self, team_id: str) -> List[Dict[str, Any]]:
        """Get average player ratings for a team."""
        sofa_id = self.TEAM_IDS.get(team_id)
        if not sofa_id:
            return []
        
        url = f"{self.API_URL}/team/{sofa_id}/unique-tournament/{self.UCL_TOURNAMENT_ID}/season/{self.UCL_SEASON_ID}/top-players/overall"
        data = await self.fetch_json(url)
        
        if not data:
            return []
        
        players = []
        for category in data.get("topPlayers", {}).values():
            for item in category:
                player = item.get("player", {})
                players.append({
                    "name": player.get("name"),
                    "id": player.get("id"),
                    "position": player.get("position"),
                    "rating": item.get("statistics", {}).get("rating"),
                    "appearances": item.get("statistics", {}).get("appearances"),
                    "source": "sofascore"
                })
        
        return players
