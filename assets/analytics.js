document.addEventListener('DOMContentLoaded', function () {
    if (typeof Chart === 'undefined' || typeof kosherAnalytics === 'undefined') {
        return;
    }

    const chartData = kosherAnalytics.charts || {};
    const hasValues = values => Array.isArray(values) && values.some(value => Number(value) > 0);
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--kosher-analytics-ink').trim() || '#1d2327';
    const muted = css.getPropertyValue('--kosher-analytics-muted').trim() || '#667085';
    const border = 'rgba(148, 163, 184, 0.24)';

    Chart.defaults.font.family = '"Aptos", "Segoe UI", sans-serif';
    Chart.defaults.color = muted;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.tooltip.backgroundColor = '#111827';
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 12;
    Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
    Chart.defaults.plugins.tooltip.bodyColor = '#dbeafe';

    renderTimelineChart();
    renderCategoryChart();
    renderTopStoriesChart();
    renderDropoffChart();
    bindFilterEnhancements();

    function renderTimelineChart() {
        const canvas = document.getElementById('kosherViewsChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 320);
        gradient.addColorStop(0, 'rgba(37, 99, 235, 0.28)');
        gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');

        new Chart(canvas, {
            type: 'line',
            data: {
                labels: chartData.timeline?.labels || [],
                datasets: [
                    {
                        label: 'Views',
                        data: chartData.timeline?.views || [],
                        borderColor: '#2563eb',
                        backgroundColor: gradient,
                        borderWidth: 3,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#2563eb',
                        tension: 0.38,
                        fill: true
                    },
                    {
                        label: 'Unique viewers',
                        data: chartData.timeline?.unique || [],
                        borderColor: '#0f766e',
                        backgroundColor: 'rgba(15, 118, 110, 0.08)',
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        tension: 0.38,
                        fill: false
                    }
                ]
            },
            options: {
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { maxRotation: 0, autoSkipPadding: 20 }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: border },
                        ticks: { precision: 0 }
                    }
                }
            }
        });
    }

    function renderCategoryChart() {
        const canvas = document.getElementById('kosherCategoryChart');
        if (!canvas) return;

        const values = chartData.categories?.views || [];

        new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: chartData.categories?.labels || ['No data'],
                datasets: [{
                    data: hasValues(values) ? values : [1],
                    backgroundColor: hasValues(values)
                        ? ['#2563eb', '#0f766e', '#f59e0b', '#b45309', '#7c3aed', '#db2777', '#475569', '#16a34a']
                        : ['#e5e7eb'],
                    borderColor: '#ffffff',
                    borderWidth: 4,
                    hoverOffset: 8
                }]
            },
            options: {
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    function renderTopStoriesChart() {
        const canvas = document.getElementById('kosherTopStoriesChart');
        if (!canvas) return;

        const values = chartData.topStories?.views || [];

        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: chartData.topStories?.labels || [],
                datasets: [{
                    label: 'Views',
                    data: values,
                    borderRadius: 12,
                    borderSkipped: false,
                    backgroundColor: '#1d4ed8',
                    hoverBackgroundColor: '#0f766e'
                }]
            },
            options: {
                indexAxis: 'y',
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: border },
                        ticks: { precision: 0 }
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            color: ink,
                            font: { weight: 700 }
                        }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    function renderDropoffChart() {
        const canvas = document.getElementById('kosherDropoffChart');
        if (!canvas) return;

        const values = chartData.dropoffs?.exits || [];

        new Chart(canvas, {
            type: 'bar',
            data: {
                labels: chartData.dropoffs?.labels || [],
                datasets: [{
                    label: 'Exits',
                    data: values,
                    borderRadius: 12,
                    borderSkipped: false,
                    backgroundColor: '#d97706',
                    hoverBackgroundColor: '#b45309'
                }]
            },
            options: {
                indexAxis: 'y',
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: border },
                        ticks: { precision: 0 }
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            color: ink,
                            font: { weight: 700 }
                        }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    function bindFilterEnhancements() {
        document.querySelectorAll('.kosher-analytics-tabs input[type="radio"]').forEach(input => {
            input.addEventListener('change', function () {
                const form = input.closest('form');
                if (form && input.value !== 'range') {
                    form.submit();
                }
            });
        });

        document.querySelectorAll('.kosher-analytics-date-fields input[type="date"]').forEach(input => {
            input.addEventListener('change', function () {
                const customPeriod = document.querySelector('.kosher-analytics-tabs input[value="range"]');
                if (customPeriod) {
                    customPeriod.checked = true;
                }
            });
        });
    }
});
