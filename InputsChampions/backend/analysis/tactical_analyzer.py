"""
Tactical Analyzer - Evaluates team tactical performance.
Analyzes formations, playing style, home/away performance, and consistency.
"""
from typing import Dict, Any, List


class TacticalAnalyzer:
    """Analyzes team tactical setup and performance patterns."""
    
    # Weights for tactical score calculation
    WEIGHTS = {
        "form": 0.35,
        "consistency": 0.25,
        "home_away": 0.20,
        "style": 0.20
    }
    
    # Formation effectiveness ratings (based on UCL historical data)
    FORMATION_RATINGS = {
        "4-3-3": 85,
        "4-2-3-1": 82,
        "3-5-2": 78,
        "4-4-2": 75,
        "3-4-3": 80,
        "4-1-4-1": 77,
        "5-3-2": 72,
        "4-3-2-1": 76,
    }
    
    def analyze(self, team_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze team's tactical setup and patterns.
        
        Args:
            team_data: Team data with form and stats
            
        Returns:
            Tactical analysis with scores and insights
        """
        form = team_data.get("form", {})
        stats = team_data.get("stats", {})
        
        # Calculate individual metrics
        form_score = self._calculate_form_score(form)
        consistency_score = self._calculate_consistency_score(form, stats)
        home_away_score = self._calculate_home_away_score(form, stats)
        style_score = self._calculate_style_score(stats)
        
        # Calculate weighted overall tactical score
        overall_score = (
            form_score * self.WEIGHTS["form"] +
            consistency_score * self.WEIGHTS["consistency"] +
            home_away_score * self.WEIGHTS["home_away"] +
            style_score * self.WEIGHTS["style"]
        )
        
        return {
            "tactical_score": round(overall_score, 1),
            "form_score": round(form_score, 1),
            "consistency_score": round(consistency_score, 1),
            "home_away_score": round(home_away_score, 1),
            "style_score": round(style_score, 1),
            # Form details
            "form_string": form.get("form_string", ""),
            "last_5": form.get("last_5", []),
            "current_form": self._get_form_quality(form),
            # Tactical insights
            "preferred_formation": self._estimate_formation(stats),
            "playing_style": self._determine_playing_style(stats),
            "home_advantage": self._calculate_home_advantage(stats),
            "momentum": self._calculate_momentum(form),
            "tactical_status": self._get_status_label(overall_score)
        }
    
    def _calculate_form_score(self, form: Dict[str, Any]) -> float:
        """Calculate score based on recent results."""
        form_string = form.get("form_string", "")
        
        if not form_string:
            return 60.0  # Neutral if no data
        
        wins = form_string.count("W")
        draws = form_string.count("D")
        losses = form_string.count("L")
        total = len(form_string)
        
        if total == 0:
            return 60.0
        
        # Points calculation (W=3, D=1, L=0)
        points = (wins * 3) + draws
        max_points = total * 3
        
        # Convert to percentage score
        return (points / max_points) * 100
    
    def _calculate_consistency_score(self, form: Dict[str, Any], stats: Dict[str, Any]) -> float:
        """Calculate tactical consistency score."""
        form_string = form.get("form_string", "")
        
        if len(form_string) < 3:
            return 70.0  # Not enough data
        
        # Check for consistency in results
        # Alternating results = inconsistent
        changes = 0
        for i in range(1, len(form_string)):
            if form_string[i] != form_string[i-1]:
                changes += 1
        
        # Less changes = more consistent
        max_changes = len(form_string) - 1
        consistency_ratio = 1 - (changes / max_changes) if max_changes > 0 else 0.5
        
        return 40 + (consistency_ratio * 60)
    
    def _calculate_home_away_score(self, form: Dict[str, Any], stats: Dict[str, Any]) -> float:
        """Calculate home/away balance score."""
        last_5 = form.get("last_5", [])
        
        if not last_5:
            return 70.0
        
        home_results = [m for m in last_5 if isinstance(m, dict) and m.get("is_home")]
        away_results = [m for m in last_5 if isinstance(m, dict) and not m.get("is_home")]
        
        # If form is strings instead of dicts
        if last_5 and isinstance(last_5[0], str):
            # Assume roughly equal home/away split
            return 75.0
        
        # Calculate win rates
        home_wins = sum(1 for m in home_results if m.get("result") == "W")
        away_wins = sum(1 for m in away_results if m.get("result") == "W")
        
        home_rate = home_wins / len(home_results) if home_results else 0.5
        away_rate = away_wins / len(away_results) if away_results else 0.5
        
        # Good away form is valuable
        away_bonus = away_rate * 20 if away_rate > 0.4 else 0
        
        return 50 + (home_rate * 30) + away_bonus
    
    def _calculate_style_score(self, stats: Dict[str, Any]) -> float:
        """Calculate playing style effectiveness score."""
        possession = stats.get("possession_avg", 50)
        goals = stats.get("goals", 0)
        goals_conceded = stats.get("goals_conceded", 0)
        
        # Determine style type
        style = self._determine_playing_style(stats)
        
        # Style effectiveness based on results
        goal_diff = goals - goals_conceded
        
        base_score = 60
        
        # Adjust based on style-result alignment
        if style in ["Possession-Based", "Attacking"] and goal_diff > 0:
            base_score += 25
        elif style == "Counter-Attacking" and goal_diff > 0:
            base_score += 20
        elif style == "Defensive" and goals_conceded < 6:
            base_score += 15
        
        return min(100, base_score)
    
    def _estimate_formation(self, stats: Dict[str, Any]) -> str:
        """Estimate preferred formation based on stats."""
        possession = stats.get("possession_avg", 50)
        
        # High possession teams tend to use 4-3-3 or 4-2-3-1
        if possession >= 58:
            return "4-3-3"
        elif possession >= 52:
            return "4-2-3-1"
        else:
            return "4-4-2"
    
    def _determine_playing_style(self, stats: Dict[str, Any]) -> str:
        """Determine team's playing style."""
        possession = stats.get("possession_avg", 50)
        goals = stats.get("goals", 0)
        goals_conceded = stats.get("goals_conceded", 0)
        
        if possession >= 58:
            return "Possession-Based"
        elif possession >= 52:
            if goals > goals_conceded:
                return "Attacking"
            else:
                return "Balanced"
        else:
            if goals_conceded < 6:
                return "Defensive"
            else:
                return "Counter-Attacking"
    
    def _calculate_home_advantage(self, stats: Dict[str, Any]) -> str:
        """Calculate home advantage indicator."""
        # In real implementation, would use actual home/away splits
        return "Strong"
    
    def _calculate_momentum(self, form: Dict[str, Any]) -> str:
        """Calculate current momentum based on recent results."""
        form_string = form.get("form_string", "")
        
        if not form_string:
            return "Neutral"
        
        # Check last 3 results for momentum
        recent = form_string[:3]
        
        wins = recent.count("W")
        losses = recent.count("L")
        
        if wins >= 2:
            return "Rising"
        elif losses >= 2:
            return "Declining"
        else:
            return "Stable"
    
    def _get_form_quality(self, form: Dict[str, Any]) -> str:
        """Get qualitative description of current form."""
        form_string = form.get("form_string", "")
        
        if not form_string:
            return "Unknown"
        
        wins = form_string.count("W")
        total = len(form_string)
        
        win_rate = wins / total if total > 0 else 0
        
        if win_rate >= 0.8:
            return "Excellent"
        elif win_rate >= 0.6:
            return "Good"
        elif win_rate >= 0.4:
            return "Mixed"
        elif win_rate >= 0.2:
            return "Poor"
        else:
            return "Critical"
    
    def _get_status_label(self, score: float) -> str:
        """Get human-readable status label."""
        if score >= 85:
            return "Dominant"
        elif score >= 70:
            return "Organized"
        elif score >= 55:
            return "Adaptable"
        elif score >= 40:
            return "Inconsistent"
        else:
            return "Disorganized"
