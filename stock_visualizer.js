// JavaScript file to visualize stock price data for selected GICS industries

// Import necessary charting library (e.g., Chart.js)
// Assuming Chart.js is included in the HTML file via a script tag


document.addEventListener('DOMContentLoaded', () => {

    let companyCodeToName = {};
    fetch('data/filtered_stock_list.json')
        .then(response => response.json())
        .then(data => {
            companyCodeToName = data;
        })
        .catch(error => console.error('Error loading company code to name data:', error));


    const industryList = document.getElementById('industry-list');
    const industryLinks = industryList.querySelectorAll('a');
    const mainViewer = document.getElementById('main-viewer');
    let chartInstance = null;
    let cachedIndustryData = {};
    let lineChartInstance = null;
    let bubblePositions = {};

    function loadStockData(industryName) {
        const selectedDate = dates[timeline.value];

        // Check if we have cached data for this industry
        if (!cachedIndustryData[industryName]) {
            // If no cached data, load and cache it
            const stockFiles = gicsIndustryData[industryName].map(stock => `${stock}.json`);
            const stockDataPromises = stockFiles.map(async (fileName, index) => {
                const stockFilePath = `data/GICS_Stock_Data/${industryName}/${fileName}`;
                try {
                    const response = await fetch(stockFilePath);
                    if (!response.ok) {
                        throw new Error(`Failed to load file: ${fileName}`);
                    }
                    const data = await response.json();
                    return {
                        data: data.map(entry => ({ ...entry, company: gicsIndustryData[industryName][index] })),
                        company: gicsIndustryData[industryName][index]
                    };
                } catch (error) {
                    console.error('Error loading stock data:', error);
                    return null;
                }
            });

            // Load and cache the data
            Promise.all(stockDataPromises)
                .then(stockDataArrays => {
                    // Cache the data
                    cachedIndustryData[industryName] = stockDataArrays.filter(data => data !== null);
                    // Display the data
                    displayIndustryData(industryName, selectedDate);
                })
                .catch(error => console.error('Error loading stock data:', error));
        } else {
            // Use cached data
            displayIndustryData(industryName, selectedDate);
        }
    }

    // New function to handle data display using cached data
    function displayIndustryData(industryName, selectedDate) {
        const stockDataArrays = cachedIndustryData[industryName];

        // Process data for the selected date
        const combinedData = stockDataArrays.map(({ data, company }) => {
            const entry = data.find(item => item.date === selectedDate);
            return {
                company: company,
                company_name: companyCodeToName[company],
                close: entry ? entry.close : null
            };
        });

        displayChart(stockDataArrays.map(item => item.data), combinedData, industryName);
    }

// Update the event listener for the timeline
    timeline.addEventListener('input', function () {
        const activeLink = document.querySelector('a[style="color: orange;"]');
        if (activeLink) {
            const industryName = activeLink.textContent;
            if (industryName === 'Overview') {
                loadOverview();
            } else {
                const selectedDate = dates[timeline.value];
                displayIndustryData(industryName, selectedDate);
            }
        }
    });


    function displayChart(stockDataArrays, stockData, industryName) {
        // Clear the previous chart if it exists
        if (chartInstance) {
            chartInstance.destroy();
        }
        if (lineChartInstance) {
            lineChartInstance.destroy();
        }

        // Clear the main viewer
        mainViewer.innerHTML = '';

        // Create container for better layout control
        const chartContainer = document.createElement('div');
        chartContainer.style.width = '100%';
        chartContainer.style.height = '500px'; // Full viewport height
        chartContainer.style.display = 'flex';
        chartContainer.style.flexDirection = 'column';
        chartContainer.style.gap = '20px'; // Space between charts
        chartContainer.style.padding = '20px';
        mainViewer.appendChild(chartContainer);

        // Create bar chart container
        const barContainer = document.createElement('div');
        barContainer.style.flex = '1'; // Take up available space
        barContainer.style.minHeight = '400px'; // Minimum height
        barContainer.style.position = 'relative';
        chartContainer.appendChild(barContainer);

        const barCtx = document.createElement('canvas');
        barContainer.appendChild(barCtx);

        // Create line chart container
        const lineContainer = document.createElement('div');
        lineContainer.style.flex = '2'; // Take up twice as much space as bar chart
        lineContainer.style.minHeight = '400px'; // Minimum height
        lineContainer.style.position = 'relative';
        chartContainer.appendChild(lineContainer);

        const lineCtx = document.createElement('canvas');
        lineContainer.appendChild(lineCtx);

        // Calculate the maximum value from all data points for consistent scaling
        const allPrices = stockDataArrays.flat().map(item => item.close);
        const maxPrice = Math.ceil(Math.max(...allPrices));
        // Round up to a nice number for the scale
        const yAxisMax = Math.ceil(maxPrice / 50) * 50;

        // Bar Chart with synchronized scale
        chartInstance = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: stockData.map(data => data.company),
                datasets: [{
                    label: `capitalization on ${dates[timeline.value]}`,
                    data: stockData.map(data => data.close),
                    backgroundColor: stockData.map(() => industryColors[industryName] || 'rgba(75, 192, 192, 0.2)'),
                    borderColor: stockData.map(() => (industryColors[industryName] || 'rgba(75, 192, 192, 0.2)').replace('0.2', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0
                },
                scales: {
                    x: {
                        beginAtZero: true
                    },
                    y: {
                        beginAtZero: true,
                        max: yAxisMax, // Set maximum scale
                        ticks: {
                            stepSize: Math.ceil(yAxisMax / 10) // Create nice step sizes
                        }
                    }
                }
            }
        });

        // Line Chart
        const lineLabels = dates.slice(0, parseInt(timeline.value) + 10);
        const colorVariation = (index, total) => {
            const hue = (index / total) * 200 + 160;
            return `hsl(${hue}, 60%, 70%, 0.8)`;
        };

        const lineDatasets = stockDataArrays.map((stockData, index, array) => ({
            label: companyCodeToName[stockData[0].company] || stockData[0].company,
            data: stockData.map(item => item.close),
            fill: false,
            borderColor: colorVariation(index, array.length),
            tension: 0.1
        }));

        lineChartInstance = new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: lineLabels,
                datasets: lineDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0
                },
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 20,
                            padding: 10,
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Add resize handler
        const resizeObserver = new ResizeObserver(() => {
            if (chartInstance) chartInstance.resize();
            if (lineChartInstance) lineChartInstance.resize();
        });

        resizeObserver.observe(mainViewer);

        // Cleanup function for the resize observer
        window.addEventListener('beforeunload', () => {
            resizeObserver.disconnect();
        });
    }

    industryLinks.forEach(link => {
        link.addEventListener('click', function () {
            // Remove active state from all links
            industryLinks.forEach(item => item.style.color = '');
            // Set active state for the clicked link
            this.style.color = 'orange';

            const industryName = this.textContent;
            console.log('Selected Sector:', industryName);

            if (industryName === 'Overview') {
                loadOverview();
            } else {
                // Load stock data for the selected industry
                loadStockData(industryName);
            }
        });
    });


    let cachedBubbleData = {};
    let cachedStockData = {};

    // Update loadOverview to accommodate the new layout
    async function loadOverview() {
        mainViewer.innerHTML = '';

        // Create outer container without fixed height
        const outerContainer = document.createElement('div');
        outerContainer.style.width = '100%';
        outerContainer.style.display = 'flex';
        outerContainer.style.flexDirection = 'column';
        outerContainer.style.gap = '20px';
        mainViewer.appendChild(outerContainer);

        // Create chart container with fixed height
        const chartContainer = document.createElement('div');
        chartContainer.style.width = '100%';
        chartContainer.style.height = '500px';
        chartContainer.style.position = 'relative';
        outerContainer.appendChild(chartContainer);

        const bubbleCtx = document.createElement('canvas');
        chartContainer.appendChild(bubbleCtx);

        // Create legend container that expands naturally
        const legendContainer = document.createElement('div');
        legendContainer.style.width = '100%';
        legendContainer.style.padding = '20px 0';
        outerContainer.appendChild(legendContainer);

        if (Object.keys(bubblePositions).length === 0) {
            initializePositions();
        }

        if (Object.keys(cachedStockData).length === 0) {
            await initializeCache();
        }

        const bubbleData = createBubbleDataFromCache(dates[timeline.value]);
        drawBubbleChart(bubbleData, bubbleCtx, legendContainer);
    }

    function initializePositions() {
        const industryNames = Object.keys(gicsIndustryData);
        const gridSize = Math.ceil(Math.sqrt(industryNames.length));
        const cellSize = 90 / gridSize;

        // Assign cluster centers for each industry
        const industryCenters = {};
        industryNames.forEach((industry, index) => {
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            industryCenters[industry] = {
                x: 5 + cellSize * col + cellSize/2,
                y: 5 + cellSize * row + cellSize/2
            };
        });

        // Generate positions for each company
        industryNames.forEach(industryName => {
            const companies = gicsIndustryData[industryName];
            const center = industryCenters[industryName];
            const companyCount = companies.length;
            const clusterRadius = cellSize/3;

            companies.forEach((company, index) => {
                const angle = index * 2.4;
                const radius = clusterRadius * Math.sqrt(index / companyCount);

                bubblePositions[company] = {
                    x: center.x + radius * Math.cos(angle),
                    y: center.y + radius * Math.sin(angle)
                };
            });
        });
    }

    async function initializeCache() {
        const industryNames = Object.keys(gicsIndustryData);

        for (const industryName of industryNames) {
            const companies = gicsIndustryData[industryName];

            for (const company of companies) {
                const stockFilePath = `data/GICS_Stock_Data/${industryName}/${company}.json`;
                try {
                    const response = await fetch(stockFilePath);
                    if (!response.ok) {
                        throw new Error(`Failed to load file: ${company}`);
                    }
                    const data = await response.json();
                    // Cache the full stock data
                    cachedStockData[company] = {
                        data: data,
                        industry: industryName,
                        color: industryColors[industryName] || 'rgba(75, 192, 192, 1)'
                    };
                } catch (error) {
                    console.error(`Error loading data for ${company}:`, error);
                    cachedStockData[company] = null;
                }
            }
        }
        console.log('Cache initialized');
    }

    function createBubbleDataFromCache(selectedDate) {
        const bubbleData = [];

        Object.entries(cachedStockData).forEach(([company, stockInfo]) => {
            if (stockInfo) {
                const priceData = stockInfo.data.find(item => item.date === selectedDate);
                const companyPrice = priceData ? priceData.close : 0;

                bubbleData.push({
                    x: bubblePositions[company].x,
                    y: bubblePositions[company].y,
                    r: Math.max(Math.sqrt(companyPrice) / 3, 1),
                    label: companyCodeToName[company] || company,
                    industry: stockInfo.industry,
                    price: companyPrice,
                    backgroundColor: stockInfo.color
                });
            }
        });

        return bubbleData;
    }

    function drawBubbleChart(bubbleData, ctx, legendContainer) {
        if (chartInstance) {
            chartInstance.destroy();
        }

        // Clear and style legend container
        legendContainer.innerHTML = '';
        legendContainer.style.display = 'flex';
        legendContainer.style.flexWrap = 'wrap';
        legendContainer.style.justifyContent = 'center';
        legendContainer.style.gap = '15px';
        legendContainer.style.overflow = 'visible'; // Remove scrolling

        // Create legend items
        const industries = [...new Set(bubbleData.map(d => d.industry))].sort();
        industries.forEach(industry => {
            const legendItem = document.createElement('div');
            legendItem.style.display = 'flex';
            legendItem.style.alignItems = 'center';
            legendItem.style.padding = '5px 10px';
            legendItem.style.whiteSpace = 'nowrap';

            const colorBox = document.createElement('div');
            colorBox.style.width = '12px';
            colorBox.style.height = '12px';
            colorBox.style.backgroundColor = industryColors[industry];
            colorBox.style.marginRight = '5px';
            colorBox.style.border = '1px solid rgba(0,0,0,0.2)';

            const label = document.createElement('span');
            label.textContent = industry;
            label.style.fontSize = '12px';
            label.style.color = '#666';

            legendItem.appendChild(colorBox);
            legendItem.appendChild(label);
            legendContainer.appendChild(legendItem);
        });

        // Chart configuration remains the same
        chartInstance = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Market Capitalization Overview',
                    data: bubbleData,
                    backgroundColor: bubbleData.map(d => d.backgroundColor),
                    borderColor: bubbleData.map(d => d.backgroundColor),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                animation: {
                    duration: 0
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const data = context.raw;
                                return [
                                    `Company: ${data.label}`,
                                    `Industry: ${data.industry}`,
                                    `Price: $${data.price.toFixed(2)}`
                                ];
                            }
                        }
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        display: false,
                        min: 0,
                        max: 100,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        display: false,
                        min: 0,
                        max: 100,
                        grid: {
                            display: false
                        }
                    }
                },
                layout: {
                    padding: 20
                }
            }
        });
    }

});