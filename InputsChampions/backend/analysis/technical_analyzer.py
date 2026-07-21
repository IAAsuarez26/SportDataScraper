"""
Technical Analyzer - Evaluates team technical performance.
Analyzes goals, xG, possession, passing, and defensive metrics.
"""
from typing import Dict, Any


class TechnicalAnalyzer:
    """Analyzes team technical performance and statistics."""
    
    # Weights for technical score calculation
    WEIGHTS = {
        "attack": 0.35,
        "defense": 0.30,
        "possession": 0.20,
        "efficiency": 0.15
    }
    
    # Benchmark values for top UCL teams
    BENCHMARKS = {
        "goals_per_match": {"elite": 2.5, "good": 1.8, "avg": 1.2},
        "goals_conceded_per_match": {"elite": 0.5, "good": 1.0, "avg": 1.5},
        "xg": {"elite": 2.0, "good": 1.5, "avg": 1.0},
        "xga": {"elite": 0.8, "good": 1.2, "avg": 1.6},
        "possession": {"elite": 60, "good": 52, "avg": 45},
        "pass_accuracy": {"elite": 88, "good": 82, "avg": 76},
        "clean_sheets_pct": {"elite": 50, "good": 33, "avg": 20},
        "shot_accuracy": {"elite": 45, "good": 35, "avg": 28},
    }
    
    def analyze(self, team_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze team's technical performance.
        
        Args:
            team_data: Team data with stats
            
        Returns:
            Technical analysis with scores and metrics
        """
        stats = team_data.get("stats", {})
        form = team_data.get("form", {})
        
        # Calculate individual metrics
        attack_score = self._calculate_attack_score(stats)
        defense_score = self._calculate_defense_score(stats)
        possession_score = self._calculate_possession_score(stats)
        efficiency_score = self._calculate_efficiency_score(stats)
        
        # Calculate weighted overall technical score
        overall_score = (
            attack_score * self.WEIGHTS["attack"] +
            defense_score * self.WEIGHTS["defense"] +
            possession_score * self.WEIGHTS["possession"] +
            efficiency_score * self.WEIGHTS["efficiency"]
        )
        
        return {
            "technical_score": round(overall_score, 1),
            "attack_score": round(attack_score, 1),
            "defense_score": round(defense_score, 1),
            "possession_score": round(possession_score, 1),
            "efficiency_score": round(efficiency_score, 1),
            # Raw metrics
            "goals": stats.get("goals", 0),
            "goals_conceded": stats.get("goals_conceded", 0),
            "xg": stats.get("xg", 0),
            "xga": stats.get("xga", 0),
            "possession_avg": stats.get("possession_avg", 50),
            "pass_accuracy": stats.get("pass_accuracy", 80),
            "clean_sheets": stats.get("clean_sheets", 0),
            "shots_on_target": stats.get("shots_on_target", 0),
            # Derived metrics
            "goal_difference": stats.get("goals", 0) - stats.get("goals_conceded", 0),
            "xg_difference": round(stats.get("xg", 0) - stats.get("xga", 0), 2),
            "technical_status": self._get_status_label(overall_score)
        }
    
    def _calculate_attack_score(self, stats: Dict[str, Any]) -> float:
        """Calculate attacking performance score."""
        goals = stats.get("goals", 0)
        xg = stats.get("xg", 0)
        shots_on_target = stats.get("shots_on_target", 0)
        
        # Assume 6-8 matches played in group stage
        matches = max(1, stats.get("matches", 6))
        
        goals_per_match = goals / matches if goals else 1.0
        
        # Score based on goals per match
        if goals_per_match >= self.BENCHMARKS["goals_per_match"]["elite"]:
            goal_score = 100
        elif goals_per_match >= self.BENCHMARKS["goals_per_match"]["good"]:
            goal_score = 80
        elif goals_per_match >= self.BENCHMARKS["goals_per_match"]["avg"]:
            goal_score = 60
        else:
            goal_score = 40
        
        # xG scoring (if available)
        xg_per_match = xg / matches if xg else 1.0
        if xg_per_match >= self.BENCHMARKS["xg"]["elite"]:
            xg_score = 100
        elif xg_per_match >= self.BENCHMARKS["xg"]["good"]:
            xg_score = 80
        else:
            xg_score = 60
        
        # Combine
        return (goal_score * 0.6) + (xg_score * 0.4)
    
    def _calculate_defense_score(self, stats: Dict[str, Any]) -> float:
        """Calculate defensive performance score."""
        goals_conceded = stats.get("goals_conceded", 0)
        xga = stats.get("xga", 0)
        clean_sheets = stats.get("clean_sheets", 0)
        
        matches = max(1, stats.get("matches", 6))
        
        # Goals conceded per match
        gc_per_match = goals_conceded / matches if goals_conceded else 1.0
        
        if gc_per_match <= self.BENCHMARKS["goals_conceded_per_match"]["elite"]:
            gc_score = 100
        elif gc_per_match <= self.BENCHMARKS["goals_conceded_per_match"]["good"]:
            gc_score = 80
        elif gc_per_match <= self.BENCHMARKS["goals_conceded_per_match"]["avg"]:
            gc_score = 60
        else:
            gc_score = 40
        
        # Clean sheets percentage
        cs_pct = (clean_sheets / matches) * 100 if clean_sheets else 0
        if cs_pct >= self.BENCHMARKS["clean_sheets_pct"]["elite"]:
            cs_score = 100
        elif cs_pct >= self.BENCHMARKS["clean_sheets_pct"]["good"]:
            cs_score = 80
        else:
            cs_score = 60
        
        return (gc_score * 0.7) + (cs_score * 0.3)
    
    def _calculate_possession_score(self, stats: Dict[str, Any]) -> float:
        """Calculate possession and passing score."""
        possession = stats.get("possession_avg", 50)
        pass_accuracy = stats.get("pass_accuracy", 80)
        
        # Possession score
        if possession >= self.BENCHMARKS["possession"]["elite"]:
            poss_score = 100
        elif possession >= self.BENCHMARKS["possession"]["good"]:
            poss_score = 80
        elif possession >= self.BENCHMARKS["possession"]["avg"]:
            poss_score = 60
        else:
            poss_score = 45
        
        # Pass accuracy score
        if pass_accuracy >= self.BENCHMARKS["pass_accuracy"]["elite"]:
            pass_score = 100
        elif pass_accuracy >= self.BENCHMARKS["pass_accuracy"]["good"]:
            pass_score = 80
        else:
            pass_score = 60
        
        return (poss_score * 0.5) + (pass_score * 0.5)
    
    def _calculate_efficiency_score(self, stats: Dict[str, Any]) -> float:
        """Calculate efficiency metrics (shot conversion, etc.)."""
        goals = stats.get("goals", 0)
        shots_on_target = stats.get("shots_on_target", 1)
        xg = stats.get("xg", 1)
        
        # Goal conversion from shots on target
        shot_conversion = (goals / shots_on_target) * 100 if shots_on_target else 30
        
        # xG overperformance
        xg_overperformance = goals - xg if xg else 0
        
        base_score = 70
        
        # Adjust for efficiency
        if shot_conversion >= 40:
            base_score += 20
        elif shot_conversion >= 30:
            base_score += 10
        
        # Adjust for xG overperformance
        if xg_overperformance > 2:
            base_score += 15
        elif xg_overperformance > 0:
            base_score += 8
        elif xg_overperformance < -2:
            base_score -= 10
        
        return max(0, min(100, base_score))
    
    def _get_status_label(self, score: float) -> str:
        """Get human-readable status label."""
        if score >= 85:
            return "Elite"
        elif score >= 70:
            return "Strong"
        elif score >= 55:
            return "Solid"
        elif score >= 40:
            return "Developing"
        else:
            return "Struggling"
