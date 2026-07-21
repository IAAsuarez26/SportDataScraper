/**
 * Chart utilities for UCL Squad Analyzer
 * Uses Chart.js for data visualization
 */

// Chart.js default configuration
Chart.defaults.color = '#9ca3af';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
Chart.defaults.font.family = "'Inter', sans-serif";

/**
 * Create scores distribution chart
 */
function createScoresChart(ctx, teams) {
    // Destroy existing chart if present
    if (ctx.chart) {
        ctx.chart.destroy();
    }

    // Prepare data - group teams by score ranges
    const ranges = {
        '80-100': 0,
        '70-79': 0,
        '60-69': 0,
        '50-59': 0,
        '0-49': 0
    };

    teams.forEach(team => {
        const score = team.overall_score || team.analysis?.overall_score || 70;
        if (score >= 80) ranges['80-100']++;
        else if (score >= 70) ranges['70-79']++;
        else if (score >= 60) ranges['60-69']++;
        else if (score >= 50) ranges['50-59']++;
        else ranges['0-49']++;
    });

    ctx.chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Elite (80-100)', 'Strong (70-79)', 'Good (60-69)', 'Moderate (50-59)', 'Developing (0-49)'],
            datasets: [{
                label: 'Number of Teams',
                data: Object.values(ranges),
                backgroundColor: [
                    'rgba(16, 185, 129, 0.7)',
                    'rgba(6, 182, 212, 0.7)',
                    'rgba(59, 130, 246, 0.7)',
                    'rgba(245, 158, 11, 0.7)',
                    'rgba(239, 68, 68, 0.7)'
                ],
                borderColor: [
                    'rgb(16, 185, 129)',
                    'rgb(6, 182, 212)',
                    'rgb(59, 130, 246)',
                    'rgb(245, 158, 11)',
                    'rgb(239, 68, 68)'
                ],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.9)',
                    titleColor: '#f9fafb',
                    bodyColor: '#9ca3af',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 2
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });

    return ctx.chart;
}

/**
 * Create countries distribution chart
 */
function createCountriesChart(ctx, teams) {
    // Destroy existing chart if present
    if (ctx.chart) {
        ctx.chart.destroy();
    }

    // Count teams by country
    const countryCounts = {};
    teams.forEach(team => {
        const country = team.country || 'Unknown';
        countryCounts[country] = (countryCounts[country] || 0) + 1;
    });

    // Sort by count and take top 8
    const sorted = Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const colors = [
        '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e',
        '#f97316', '#eab308', '#22c55e', '#06b6d4'
    ];

    ctx.chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sorted.map(([country]) => country),
            datasets: [{
                data: sorted.map(([, count]) => count),
                backgroundColor: colors.map(c => c + 'cc'),
                borderColor: colors,
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        padding: 12,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.9)',
                    titleColor: '#f9fafb',
                    bodyColor: '#9ca3af',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function (context) {
                            return `${context.label}: ${context.raw} teams`;
                        }
                    }
                }
            }
        }
    });

    return ctx.chart;
}

/**
 * Create radar chart for team comparison
 */
function createComparisonRadar(ctx, team1, team2) {
    // Destroy existing chart if present
    if (ctx.chart) {
        ctx.chart.destroy();
    }

    const labels = ['Physical', 'Technical', 'Tactical', 'Attack', 'Defense', 'Form'];

    // Extract scores from analysis
    const getScores = (team) => {
        const analysis = team.analysis || team;
        return [
            analysis.physical?.physical_score || analysis.physical_score || 70,
            analysis.technical?.technical_score || analysis.technical_score || 70,
            analysis.tactical?.tactical_score || analysis.tactical_score || 70,
            analysis.technical?.attack_score || 70,
            analysis.technical?.defense_score || 70,
            analysis.tactical?.form_score || 70
        ];
    };

    ctx.chart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: team1.team_name || team1.name,
                    data: getScores(team1),
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgb(59, 130, 246)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(59, 130, 246)'
                },
                {
                    label: team2.team_name || team2.name,
                    data: getScores(team2),
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    borderColor: 'rgb(239, 68, 68)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgb(239, 68, 68)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(239, 68, 68)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20,
                        backdropColor: 'transparent'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    pointLabels: {
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.9)',
                    titleColor: '#f9fafb',
                    bodyColor: '#9ca3af',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8
                }
            }
        }
    });

    return ctx.chart;
}

/**
 * Create gauge SVG for score display
 */
function createGaugeSVG(score, type) {
    const circumference = 2 * Math.PI * 54; // radius = 54
    const offset = circumference - (score / 100) * circumference;

    const colors = {
        physical: '#10b981',
        technical: '#06b6d4',
        tactical: '#f59e0b'
    };

    const color = colors[type] || '#3b82f6';

    return `
        <svg width="120" height="120" viewBox="0 0 120 120">
            <circle class="gauge-bg" cx="60" cy="60" r="54"/>
            <circle 
                class="gauge-fill ${type}" 
                cx="60" 
                cy="60" 
                r="54"
                stroke="${color}"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${offset}"
            />
        </svg>
    `;
}

// Export for use in other scripts
window.createScoresChart = createScoresChart;
window.createCountriesChart = createCountriesChart;
window.createComparisonRadar = createComparisonRadar;
window.createGaugeSVG = createGaugeSVG;
