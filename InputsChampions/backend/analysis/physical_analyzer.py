"""
Physical Analyzer - Evaluates team physical condition.
Analyzes injuries, fatigue, rest days, and fixture congestion.
"""
from typing import Dict, Any, List
from datetime import datetime, timedelta


class PhysicalAnalyzer:
    """Analyzes team physical condition and fitness."""
    
    # Weights for physical score calculation
    WEIGHTS = {
        "injuries": 0.35,
        "rest_days": 0.25,
        "fatigue": 0.25,
        "key_players": 0.15
    }
    
    # Key players by position (typical starters)
    KEY_POSITIONS = ["Goalkeeper", "Centre-Back", "Central Midfield", "Striker", "Forward"]
    
    def analyze(self, team_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze team's physical condition.
        
        Args:
            team_data: Team data with injuries, fixtures, form
            
        Returns:
            Physical analysis with scores and details
        """
        injuries = team_data.get("injuries", [])
        form = team_data.get("form", {})
        
        # Calculate individual metrics
        injury_score = self._calculate_injury_score(injuries)
        rest_score = self._calculate_rest_score(team_data)
        fatigue_score = self._calculate_fatigue_score(form)
        key_players_score = self._calculate_key_players_score(injuries)
        
        # Calculate weighted overall physical score
        overall_score = (
            injury_score * self.WEIGHTS["injuries"] +
            rest_score * self.WEIGHTS["rest_days"] +
            fatigue_score * self.WEIGHTS["fatigue"] +
            key_players_score * self.WEIGHTS["key_players"]
        )
        
        return {
            "physical_score": round(overall_score, 1),
            "injury_score": round(injury_score, 1),
            "rest_score": round(rest_score, 1),
            "fatigue_score": round(fatigue_score, 1),
            "key_players_score": round(key_players_score, 1),
            "injuries_count": len(injuries),
            "injuries_list": injuries[:5],  # Top 5 injuries
            "key_players_out": self._get_key_players_out(injuries),
            "rest_days": self._estimate_rest_days(team_data),
            "fatigue_index": round(100 - fatigue_score, 1),
            "physical_status": self._get_status_label(overall_score)
        }
    
    def _calculate_injury_score(self, injuries: List[Dict[str, Any]]) -> float:
        """
        Calculate score based on injuries.
        More injuries = lower score.
        """
        if not injuries:
            return 100.0
        
        # Score decreases by severity
        injury_count = len(injuries)
        
        # Count by status
        out_count = sum(1 for i in injuries if i.get("status", "").lower() in ["out", "out for season"])
        doubtful_count = sum(1 for i in injuries if "doubtful" in i.get("status", "").lower())
        
        # Base score reduction
        score = 100 - (out_count * 8) - (doubtful_count * 3)
        
        # Additional penalty for too many injuries
        if injury_count > 5:
            score -= (injury_count - 5) * 5
        
        return max(0, min(100, score))
    
    def _calculate_rest_score(self, team_data: Dict[str, Any]) -> float:
        """
        Calculate score based on rest days between matches.
        More rest = higher score.
        """
        rest_days = self._estimate_rest_days(team_data)
        
        # Ideal rest is 5-7 days
        if rest_days >= 7:
            return 100.0
        elif rest_days >= 5:
            return 90.0
        elif rest_days >= 4:
            return 75.0
        elif rest_days >= 3:
            return 55.0
        elif rest_days >= 2:
            return 35.0
        else:
            return 20.0
    
    def _estimate_rest_days(self, team_data: Dict[str, Any]) -> int:
        """Estimate days since last match."""
        # Default to 4 days (typical midweek-weekend cycle)
        # In real implementation, would calculate from actual fixture dates
        form = team_data.get("form", {})
        last_5 = form.get("last_5", [])
        
        # If team played recently (has form data), estimate based on typical schedule
        if last_5:
            return 4  # Typical rest between matches
        return 7  # Default if no recent match data
    
    def _calculate_fatigue_score(self, form: Dict[str, Any]) -> float:
        """
        Calculate fatigue score based on recent match load.
        """
        last_5 = form.get("last_5", [])
        
        if not last_5:
            return 70.0  # Neutral if no data
        
        matches_played = len(last_5)
        
        # More matches = more fatigue (lower score)
        if matches_played >= 5:
            base_score = 60.0
        elif matches_played >= 4:
            base_score = 70.0
        elif matches_played >= 3:
            base_score = 80.0
        else:
            base_score = 90.0
        
        # Winning boosts morale (reduces perceived fatigue)
        wins = form.get("wins", 0)
        morale_boost = wins * 4
        
        return min(100, base_score + morale_boost)
    
    def _calculate_key_players_score(self, injuries: List[Dict[str, Any]]) -> float:
        """
        Calculate score based on key player availability.
        """
        if not injuries:
            return 100.0
        
        key_out = self._get_key_players_out(injuries)
        
        # Each key player out reduces score significantly
        score = 100 - (len(key_out) * 15)
        
        return max(0, min(100, score))
    
    def _get_key_players_out(self, injuries: List[Dict[str, Any]]) -> List[str]:
        """Get list of key players currently injured."""
        key_out = []
        
        for injury in injuries:
            status = injury.get("status", "").lower()
            if status in ["out", "out for season"]:
                key_out.append(injury.get("player_name", "Unknown"))
        
        return key_out[:5]  # Limit to top 5
    
    def _get_status_label(self, score: float) -> str:
        """Get human-readable status label."""
        if score >= 85:
            return "Excellent"
        elif score >= 70:
            return "Good"
        elif score >= 55:
            return "Moderate"
        elif score >= 40:
            return "Concerning"
        else:
            return "Critical"
