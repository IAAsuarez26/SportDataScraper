"""
Match Predictor - Predicts match outcomes based on team analyses.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime

from .composite_scorer import CompositeScorer


class MatchPredictor:
    """Predicts match outcomes based on team form analysis."""
    
    # Factors for prediction
    HOME_ADVANTAGE = 1.05  # 5% boost for home team
    
    def __init__(self):
        self.scorer = CompositeScorer()
    
    def predict_match(
        self,
        home_team: Dict[str, Any],
        away_team: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Predict outcome of a single match.
        
        Args:
            home_team: Home team data
            away_team: Away team data
            
        Returns:
            Prediction with probabilities and analysis
        """
        # Analyze both teams
        home_analysis = self.scorer.analyze_team(home_team)
        away_analysis = self.scorer.analyze_team(away_team)
        
        # Apply home advantage
        home_score = home_analysis["overall_score"] * self.HOME_ADVANTAGE
        away_score = away_analysis["overall_score"]
        
        # Calculate probabilities
        total = home_score + away_score
        home_base = (home_score / total) * 100 if total > 0 else 50
        
        # Adjust for draws (UCL has ~20% draw rate)
        draw_chance = 22
        home_win = home_base * (1 - draw_chance/100)
        away_win = (100 - home_base) * (1 - draw_chance/100)
        
        # Determine favorite
        if home_win > away_win + 5:
            favorite = home_team.get("name")
            confidence = "High" if home_win > away_win + 15 else "Moderate"
        elif away_win > home_win + 5:
            favorite = away_team.get("name")
            confidence = "High" if away_win > home_win + 15 else "Moderate"
        else:
            favorite = "Even Match"
            confidence = "Low"
        
        # Key factors
        key_factors = self._identify_key_factors(home_analysis, away_analysis)
        
        return {
            "home_team": home_team.get("name"),
            "away_team": away_team.get("name"),
            "probabilities": {
                "home_win": round(home_win, 1),
                "draw": draw_chance,
                "away_win": round(away_win, 1)
            },
            "favorite": favorite,
            "confidence": confidence,
            "home_analysis": {
                "overall_score": home_analysis["overall_score"],
                "physical_score": home_analysis["physical"]["physical_score"],
                "technical_score": home_analysis["technical"]["technical_score"],
                "tactical_score": home_analysis["tactical"]["tactical_score"],
                "form": home_analysis["tactical"]["form_string"],
                "injuries": home_analysis["physical"]["injuries_count"]
            },
            "away_analysis": {
                "overall_score": away_analysis["overall_score"],
                "physical_score": away_analysis["physical"]["physical_score"],
                "technical_score": away_analysis["technical"]["technical_score"],
                "tactical_score": away_analysis["tactical"]["tactical_score"],
                "form": away_analysis["tactical"]["form_string"],
                "injuries": away_analysis["physical"]["injuries_count"]
            },
            "key_factors": key_factors,
            "expected_goals": self._predict_goals(home_analysis, away_analysis),
            "recommended_bet": self._get_betting_recommendation(home_win, away_win, draw_chance),
            "match_character": self._predict_match_character(home_analysis, away_analysis)
        }
    
    def predict_fixtures(
        self,
        fixtures: List[Dict[str, Any]],
        teams: Dict[str, Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Predict outcomes for a list of fixtures.
        
        Args:
            fixtures: List of fixture data
            teams: Dictionary of team data keyed by team_id
            
        Returns:
            List of predictions
        """
        predictions = []
        
        for fixture in fixtures:
            home_id = fixture.get("home_team_id") or self._normalize_team_name(fixture.get("home_team", ""))
            away_id = fixture.get("away_team_id") or self._normalize_team_name(fixture.get("away_team", ""))
            
            home_team = teams.get(home_id, {"id": home_id, "name": fixture.get("home_team")})
            away_team = teams.get(away_id, {"id": away_id, "name": fixture.get("away_team")})
            
            prediction = self.predict_match(home_team, away_team)
            prediction["fixture_date"] = fixture.get("date") or fixture.get("start_timestamp")
            prediction["round"] = fixture.get("round")
            
            predictions.append(prediction)
        
        return predictions
    
    def _normalize_team_name(self, name: str) -> str:
        """Convert team name to ID format."""
        return name.lower().replace(" ", "-").replace(".", "")
    
    def _identify_key_factors(
        self,
        home: Dict[str, Any],
        away: Dict[str, Any]
    ) -> List[str]:
        """Identify key factors that will influence the match."""
        factors = []
        
        # Physical advantage
        home_physical = home["physical"]["physical_score"]
        away_physical = away["physical"]["physical_score"]
        if abs(home_physical - away_physical) > 10:
            better = home["team_name"] if home_physical > away_physical else away["team_name"]
            factors.append(f"{better} has better physical condition")
        
        # Injury concerns
        home_injuries = home["physical"]["injuries_count"]
        away_injuries = away["physical"]["injuries_count"]
        if home_injuries > 3:
            factors.append(f"{home['team_name']} dealing with {home_injuries} injuries")
        if away_injuries > 3:
            factors.append(f"{away['team_name']} dealing with {away_injuries} injuries")
        
        # Form comparison
        home_form = home["tactical"]["form_score"]
        away_form = away["tactical"]["form_score"]
        if abs(home_form - away_form) > 15:
            better = home["team_name"] if home_form > away_form else away["team_name"]
            factors.append(f"{better} in better recent form")
        
        # Technical advantage
        home_tech = home["technical"]["technical_score"]
        away_tech = away["technical"]["technical_score"]
        if abs(home_tech - away_tech) > 10:
            better = home["team_name"] if home_tech > away_tech else away["team_name"]
            factors.append(f"{better} technically superior")
        
        # Home advantage
        factors.append(f"{home['team_name']} has home advantage")
        
        return factors[:4]  # Limit to top 4 factors
    
    def _predict_goals(
        self,
        home: Dict[str, Any],
        away: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Predict expected goals."""
        home_attack = home["technical"]["attack_score"]
        away_defense = away["technical"]["defense_score"]
        away_attack = away["technical"]["attack_score"]
        home_defense = home["technical"]["defense_score"]
        
        # Rough expected goals calculation
        home_xg = (home_attack / 100) * (1 - away_defense / 200) * 2.5
        away_xg = (away_attack / 100) * (1 - home_defense / 200) * 2.0  # Away penalty
        
        total_xg = home_xg + away_xg
        
        return {
            "home_expected": round(home_xg, 1),
            "away_expected": round(away_xg, 1),
            "total_expected": round(total_xg, 1),
            "over_2_5_likely": total_xg > 2.5,
            "both_to_score_likely": home_xg > 0.8 and away_xg > 0.8
        }
    
    def _get_betting_recommendation(
        self,
        home_win: float,
        away_win: float,
        draw: float
    ) -> str:
        """Get betting recommendation."""
        if home_win > 55:
            return "Home Win"
        elif away_win > 55:
            return "Away Win"
        elif home_win > 40 and away_win > 40:
            return "Both Teams to Score or Over 2.5"
        else:
            return "Draw or Double Chance"
    
    def _predict_match_character(
        self,
        home: Dict[str, Any],
        away: Dict[str, Any]
    ) -> str:
        """Predict the character/style of the match."""
        home_style = home["tactical"].get("playing_style", "Balanced")
        away_style = away["tactical"].get("playing_style", "Balanced")
        
        home_possession = home["technical"].get("possession_avg", 50)
        away_possession = away["technical"].get("possession_avg", 50)
        
        if home_style == "Possession-Based" and away_style == "Counter-Attacking":
            return "Tactical battle - possession vs counter"
        elif home_style == "Attacking" and away_style == "Attacking":
            return "High-scoring open game expected"
        elif "Defensive" in home_style or "Defensive" in away_style:
            return "Tight, low-scoring affair likely"
        else:
            return "Balanced contest with periods of control"
