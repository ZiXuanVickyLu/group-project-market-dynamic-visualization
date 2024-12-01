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

    // Find the Overview link and set it as active
    const overviewLink = document.querySelector('#industry-list a:first-child');
    if (overviewLink) {
        // Set the color to orange (as your active state)
        overviewLink.style.color = 'orange';
        // Load the Overview visualization
        loadOverview();
    }

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
                marketCap: entry ? calculateMarketCap(
                    parseFloat(entry.turnover),
                    parseFloat(entry.turnover_rate),
                    parseFloat(entry.close)
                ) : null
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
        chartContainer.style.height = '900px'; // Full viewport height
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
        const allMarketCaps = stockDataArrays.flat().map(item => 
            calculateMarketCap(
                parseFloat(item.turnover),
                parseFloat(item.turnover_rate),
                parseFloat(item.close)
            )
        );
        const maxMarketCap = Math.ceil(Math.max(...allMarketCaps));
        const yAxisMax = Math.ceil(maxMarketCap / 10) * 10; // Round to nearest 10B

        // Bar Chart with synchronized scale
        chartInstance = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: stockData.map(data => data.company),
                datasets: [{
                    label: `Market Cap (Billion USD) on ${dates[timeline.value]}`,
                    data: stockData.map(data => data.marketCap),
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
                plugins: {
                    title: {
                        display: true,
                        text: `Market Cap (Billion USD) on ${dates[timeline.value]}`,
                        font: {
                            size: 16
                        },
                        padding: {
                            top: 10,
                            bottom: 10
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true
                    },
                    y: {
                        beginAtZero: true,
                        max: yAxisMax,
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(1) + 'B';
                            }
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
            data: stockData.map(item => calculateMarketCap(
                parseFloat(item.turnover),
                parseFloat(item.turnover_rate),
                parseFloat(item.close)
            )),
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
                    title: {
                        display: true,
                        text: `Stock Closing Price (USD) on ${dates[timeline.value]}`,
                        font: {
                            size: 16
                        },
                        padding: {
                            top: 10,
                            bottom: 10
                        }
                    },
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

        // Create outer container with fixed dimensions and padding
        const outerContainer = document.createElement('div');
        outerContainer.style.width = '100%';
        outerContainer.style.height = '900px'; // Increased height to accommodate legend
        outerContainer.style.display = 'flex';
        outerContainer.style.flexDirection = 'column';
        outerContainer.style.padding = '10px'; // Add padding to prevent bubble clipping
        mainViewer.appendChild(outerContainer);

        // Create chart container with fixed dimensions
        const chartContainer = document.createElement('div');
        chartContainer.style.width = '100%';
        chartContainer.style.height = '900px'; // Increased height
        chartContainer.style.position = 'relative';
        chartContainer.style.backgroundColor = '#ffffff';
        outerContainer.appendChild(chartContainer);

        const bubbleCtx = document.createElement('canvas');
        bubbleCtx.style.width = '100%';
        bubbleCtx.style.height = '100%';
        chartContainer.appendChild(bubbleCtx);

        // Create legend container
        const legendContainer = document.createElement('div');
        legendContainer.style.width = '100%';
        legendContainer.style.height = '260px'; // Fixed height for legend
        legendContainer.style.marginTop = '20px';
        legendContainer.style.display = 'flex';
        legendContainer.style.flexWrap = 'wrap';
        legendContainer.style.justifyContent = 'center';
        legendContainer.style.gap = '5px';
        outerContainer.appendChild(legendContainer);

        // Add industry legends
        Object.entries(industryColors).forEach(([industry, color]) => {
            const legendItem = document.createElement('div');
            legendItem.style.display = 'flex';
            legendItem.style.alignItems = 'center';
            legendItem.style.margin = '5px 10px';
            
            const colorBox = document.createElement('span');
            colorBox.style.width = '12px';
            colorBox.style.height = '12px';
            colorBox.style.backgroundColor = color;
            colorBox.style.marginRight = '5px';
            colorBox.style.display = 'inline-block';
            
            legendItem.appendChild(colorBox);
            legendItem.appendChild(document.createTextNode(industry));
            legendContainer.appendChild(legendItem);
        });

        if (Object.keys(bubblePositions).length === 0) {
            initializePositions();
        }

        if (Object.keys(cachedStockData).length === 0) {
            await initializeCache();
        }

        const bubbleData = createBubbleDataFromCache(dates[timeline.value]);
        drawBubbleChart(bubbleData, bubbleCtx);
    }

    function initializePositions() {
        const industryNames = Object.keys(gicsIndustryData);
        const gridSize = Math.ceil(Math.sqrt(industryNames.length));
        const cellSize = 70 / gridSize;  // Keep consistent grid size

        // Fixed positions for each industry
        industryNames.forEach((industry, index) => {
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            const centerX = 0 + cellSize * col + cellSize/2;
            const centerY = 0 + cellSize * row + cellSize/2;
            
            // Store the center position for each company in the industry
            const companies = gicsIndustryData[industry];
            companies.forEach((company, companyIndex) => {
                const angle = (companyIndex / companies.length) * 2 * Math.PI;
                const radius = cellSize / 6; // Fixed radius for company distribution
                
                bubblePositions[company] = {
                    x: centerX + radius * Math.cos(angle),
                    y: centerY + radius * Math.sin(angle)
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
        const sectorData = {};
        // Remove time-based expansion
        const expansionFactor = 0.6; // Fixed expansion factor
    
        // First pass: Group companies by sector and calculate sector totals
        Object.entries(cachedStockData).forEach(([company, stockInfo]) => {
            if (!stockInfo || !bubblePositions[company]) return;
    
            const priceData = stockInfo.data.find(item => item.date === selectedDate);
            const marketCap = priceData ? calculateMarketCap(
                parseFloat(priceData.turnover),
                parseFloat(priceData.turnover_rate),
                parseFloat(priceData.close)
            ) : 0;
    
            const industry = stockInfo.industry;
            if (!sectorData[industry]) {
                sectorData[industry] = {
                    totalMarketCap: 0,
                    companies: [],
                    sumX: 0,
                    sumY: 0,
                    count: 0,
                    color: stockInfo.color
                };
            }
    
            const position = bubblePositions[company];
            sectorData[industry].totalMarketCap += marketCap;
            sectorData[industry].sumX += position.x;
            sectorData[industry].sumY += position.y;
            sectorData[industry].count++;
            sectorData[industry].companies.push({
                company,
                marketCap,
                position
            });
        });
    
        // Add sector circles (frames)
        Object.entries(sectorData).forEach(([industry, data]) => {
            const centerX = data.sumX / data.count;
            const centerY = data.sumY / data.count;
            
            // Calculate adjusted center position
            const adjustedX = 50 + (centerX - 50) * expansionFactor;
            const adjustedY = 50 + (centerY - 50) * expansionFactor;
    
            bubbleData.push({
                x: adjustedX,
                y: adjustedY,
                r: Math.sqrt(data.totalMarketCap) * 1.5 * expansionFactor,
                label: industry,
                industry: industry,
                marketCap: data.totalMarketCap,
                backgroundColor: 'transparent',
                borderColor: data.color,
                borderWidth: 2,
                isSector: true
            });
    
            // Add company bubbles for this sector
            data.companies.forEach(({ company, marketCap, position }) => {
                const adjustedCompanyX = 50 + (position.x - 50) * expansionFactor;
                const adjustedCompanyY = 50 + (position.y - 50) * expansionFactor;
    
                bubbleData.push({
                    x: adjustedCompanyX,
                    y: adjustedCompanyY,
                    r: Math.max(Math.sqrt(marketCap) * 0.8 * expansionFactor, 1),
                    label: companyCodeToName[company] || company,
                    industry: industry,
                    marketCap: marketCap,
                    backgroundColor: data.color,
                    borderColor: data.color,
                    borderWidth: 1,
                    isSector: false
                });
            });
        });
    
        return bubbleData;
    }

    function drawBubbleChart(bubbleData, ctx) {
        if (chartInstance) {
            chartInstance.destroy();
        }

        chartInstance = new Chart(ctx, {
            type: 'bubble',
            data: {
                datasets: [{
                    data: bubbleData,
                    backgroundColor: d => d.raw.backgroundColor,
                    borderColor: d => d.raw.borderColor,
                    borderWidth: d => d.raw.borderWidth,
                    hoverBackgroundColor: d => d.raw.backgroundColor,
                    hoverBorderColor: d => d.raw.borderColor,
                    hoverBorderWidth: d => d.raw.borderWidth + 1,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const data = context.raw;
                                if (data.isSector) {
                                    return [
                                        `Sector: ${data.industry}`,
                                        `Total Market Cap: $${data.marketCap.toFixed(2)}B`
                                    ];
                                }
                                return [
                                    `Company: ${data.label}`,
                                    `Industry: ${data.industry}`,
                                    `Market Cap: $${data.marketCap.toFixed(2)}B`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: false,
                        min: -10,
                        max: 100,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        display: false,
                        min: -10,
                        max: 100,
                        grid: {
                            display: false
                        }
                    }
                },
                layout: {
                    padding: 0
                }
            }
        });
    }

    // Add utility function to calculate and format market cap
    function calculateMarketCap(turnover, turnoverRate, price) {
        if (!turnoverRate || turnoverRate === 0) return 0;
        const marketCap = (turnover / turnoverRate) * price;
        return marketCap / 1000000000; // Convert to billions
    }

});