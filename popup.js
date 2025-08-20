// YouTube Filter Bubble Tracker - Popup Script
// Handles the dashboard interface and visualizations

class PopupController {
  constructor() {
    this.chart = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadDashboard();
  }

  setupEventListeners() {
    // Actions
    document.getElementById('refresh-btn')?.addEventListener('click', () => {
      this.loadDashboard();
    });

    document.getElementById('export-btn')?.addEventListener('click', () => {
      this.exportData();
    });
  }

  async loadDashboard() {
    this.showLoading();

    try {
      console.log('Popup: Requesting analytics data...');
      const response = await this.sendMessage({ action: 'getAnalytics' });
      
      if (response.success) {
        const analytics = response.data;
        console.log('Popup: Received analytics:', analytics);
        
        if (analytics.totalVideos === 0) {
          console.log('Popup: No data found, showing no-data state');
          this.showNoData();
        } else {
          console.log(`Popup: Found ${analytics.totalVideos} videos, showing dashboard`);
          this.showDashboard();
          this.populateDashboard(analytics);
        }
      } else {
        throw new Error(response.error || 'Failed to load analytics');
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      this.showError(error.message);
    }
  }

  populateDashboard(analytics) {
    // Update stats
    document.getElementById('total-videos').textContent = analytics.totalVideos;
    document.getElementById('diversity-score').textContent = analytics.diversityScore;
    document.getElementById('tracking-days').textContent = analytics.dateRange?.days || 0;

    // Update date range
    if (analytics.dateRange) {
      const dateText = analytics.dateRange.days === 1 
        ? 'Data from today'
        : `Data from ${analytics.dateRange.start} to ${analytics.dateRange.end} (${analytics.dateRange.days} days)`;
      document.getElementById('date-range-text').textContent = dateText;
    }

    // Create category chart
    this.createCategoryChart(analytics.categoryDistribution);

    // Populate top channels
    this.populateTopChannels(analytics.topChannels);
  }

  createCategoryChart(categoryDistribution) {
    const ctx = document.getElementById('category-chart');
    
    if (!ctx) return;

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
    }

    const categories = Object.keys(categoryDistribution);
    const values = Object.values(categoryDistribution);

    // Generate colors for categories
    const colors = this.generateColors(categories.length);

    this.chart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: categories,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 10,
              font: {
                size: 11
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = Math.round((value / total) * 100);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  populateTopChannels(topChannels) {
    const container = document.getElementById('top-channels-list');
    
    if (!container) return;

    container.innerHTML = '';

    if (topChannels.length === 0) {
      container.innerHTML = '<p class="no-channels">No channel data available</p>';
      return;
    }

    topChannels.forEach((channelData, index) => {
      const channelElement = document.createElement('div');
      channelElement.className = 'channel-item';
      
      channelElement.innerHTML = `
        <div class="channel-rank">${index + 1}</div>
        <div class="channel-info">
          <div class="channel-name">${this.escapeHtml(channelData.channel)}</div>
          <div class="channel-count">${channelData.count} recommendations</div>
        </div>
      `;
      
      container.appendChild(channelElement);
    });
  }

  generateColors(count) {
    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
      '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384',
      '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
    ];
    
    // If we need more colors, generate them
    while (colors.length < count) {
      colors.push(`hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`);
    }
    
    return colors.slice(0, count);
  }


  async exportData() {
    try {
      const response = await this.sendMessage({ action: 'exportData' });
      
      if (response.success) {
        const data = response.data;
        const blob = new Blob([JSON.stringify(data, null, 2)], { 
          type: 'application/json' 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `youtube-recommendations-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showMessage('Data exported successfully!', 'success');
      } else {
        throw new Error(response.error || 'Failed to export data');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      this.showMessage(error.message, 'error');
    }
  }

  showLoading() {
    this.hideAllSections();
    document.getElementById('loading').classList.remove('hidden');
  }

  showNoData() {
    this.hideAllSections();
    document.getElementById('no-data').classList.remove('hidden');
  }

  showDashboard() {
    this.hideAllSections();
    document.getElementById('dashboard').classList.remove('hidden');
  }

  hideAllSections() {
    ['loading', 'no-data', 'dashboard'].forEach(id => {
      document.getElementById(id).classList.add('hidden');
    });
  }

  showError(message) {
    this.showNoData();
    // You could implement a proper error UI here
    console.error('Dashboard error:', message);
  }

  showMessage(message, type = 'info') {
    // Create a simple toast message
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }

  sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize popup when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PopupController());
} else {
  new PopupController();
}