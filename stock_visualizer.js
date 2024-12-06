// JavaScript file to visualize stock price data for selected GICS industries


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
    let cachedStockData = {};  // Moved to top level
    let cachedBubbleData = {};
    
    // Find the Overview link and set it as active
    const overviewLink = document.querySelector('#industry-list a:first-child');
    if (overviewLink) {
        // Set the color to orange (as active state)
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

   

   
    async function loadOverview() {
        mainViewer.innerHTML = '';
    
        // Create outer container with adjusted dimensions
        const outerContainer = document.createElement('div');
        outerContainer.style.width = '100%';
        outerContainer.style.height = '80vh'; // Use viewport height instead of fixed pixels
        outerContainer.style.display = 'flex';
        outerContainer.style.flexDirection = 'column';
        outerContainer.style.padding = '0'; // Remove padding to maximize space
        mainViewer.appendChild(outerContainer);
    
        // Create chart container with adjusted dimensions
        const chartContainer = document.createElement('div');
        chartContainer.style.width = '100%';
        chartContainer.style.height = 'calc(100% - 100px)'; // Reserve space for legend
        chartContainer.style.position = 'relative';
        chartContainer.style.backgroundColor = '#ffffff';
        outerContainer.appendChild(chartContainer);
    
        const bubbleCtx = document.createElement('canvas');
        bubbleCtx.style.width = '100%';
        bubbleCtx.style.height = '80%';
        chartContainer.appendChild(bubbleCtx);
    
        // Create legend container with adjusted height
        const legendContainer = document.createElement('div');
        legendContainer.style.width = '100%';
        legendContainer.style.height = '150px';
        legendContainer.style.marginTop = '10px';
        legendContainer.style.display = 'flex';
        legendContainer.style.flexWrap = 'wrap';
        legendContainer.style.justifyContent = 'center';
        legendContainer.style.gap = '5px';
        outerContainer.appendChild(legendContainer);
    
        // Add industry legends with improved spacing
        Object.entries(industryColors).forEach(([industry, color]) => {
            const legendItem = document.createElement('div');
            legendItem.style.display = 'flex';
            legendItem.style.alignItems = 'center';
            legendItem.style.margin = '2px 8px';
            legendItem.style.fontSize = '12px';
            
            const colorBox = document.createElement('span');
            colorBox.style.width = '10px';
            colorBox.style.height = '10px';
            colorBox.style.backgroundColor = color;
            colorBox.style.marginRight = '4px';
            colorBox.style.display = 'inline-block';
            
            legendItem.appendChild(colorBox);
            legendItem.appendChild(document.createTextNode(industry));
            legendContainer.appendChild(legendItem);
        });
        
        const loadingIndicator = document.createElement('div');
        loadingIndicator.style.position = 'absolute';
        loadingIndicator.style.top = '50%';
        loadingIndicator.style.left = '50%';
        loadingIndicator.style.transform = 'translate(-50%, -50%)';
        loadingIndicator.style.fontSize = '1.2em';
        loadingIndicator.textContent = 'Loading data...';
        chartContainer.appendChild(loadingIndicator);

        try {
            if (Object.keys(bubblePositions).length === 0) {
                initializePositions();
            }
    
            if (Object.keys(cachedStockData).length === 0) {
                await initializeCache();
            }
    
            const bubbleData = createBubbleDataFromCache(dates[timeline.value]);
            chartContainer.removeChild(loadingIndicator);
            drawBubbleChart(bubbleData, bubbleCtx);
        } catch (error) {
            console.error('Error in loadOverview:', error);
            loadingIndicator.textContent = 'Error loading data. Please refresh the page.';
            loadingIndicator.style.color = 'red';
        }
    }
    
    function initializePositions() {
        const industryNames = Object.keys(gicsIndustryData);
        const gridSize = Math.ceil(Math.sqrt(industryNames.length));
        const padding = 2;
        const usableSpace = 100 - (2 * padding);
        const cellSize = usableSpace / gridSize;
    
        industryNames.forEach((industry, index) => {
            const row = Math.floor(index / gridSize);
            const col = index % gridSize;
            const centerX = padding + cellSize * col + cellSize/2;
            const centerY = padding + cellSize * row + cellSize/2;
            
            const companies = gicsIndustryData[industry];
            const companyCount = companies.length;
            
            // Calculate a tighter radius for company distribution
            const distributionRadius = cellSize / 8; // Reduced radius for tighter clustering
            
            companies.forEach((company, companyIndex) => {
                // Use a spiral arrangement for better distribution
                const angle = (companyIndex / companyCount) * 2 * Math.PI;
                // Scale radius based on position in sequence (inner companies closer to center)
                const radiusScale = Math.sqrt(companyIndex + 1) / Math.sqrt(companyCount);
                const radius = distributionRadius * radiusScale;
                
                bubblePositions[company] = {
                    x: centerX + radius * Math.cos(angle),
                    y: centerY + radius * Math.sin(angle)
                };
            });
        });
    }
   
    
    async function initializeCache() {
        const industryNames = Object.keys(gicsIndustryData);
        const loadingPromises = [];
    
        for (const industryName of industryNames) {
            const companies = gicsIndustryData[industryName];
    
            for (const company of companies) {
                const promise = (async () => {
                    const stockFilePath = `data/GICS_Stock_Data/${industryName}/${company}.json`;
                    try {
                        const response = await fetch(stockFilePath);
                        if (!response.ok) {
                            throw new Error(`Failed to load file: ${company}`);
                        }
                        const data = await response.json();
                        if (!Array.isArray(data) || data.length === 0) {
                            throw new Error(`Invalid data format for ${company}`);
                        }
                        // Cache the full stock data
                        cachedStockData[company] = {
                            data: data,
                            industry: industryName,
                            color: industryColors[industryName] || 'rgba(75, 192, 192, 1)'
                        };
                    } catch (error) {
                        console.error(`Error loading data for ${company}:`, error);
                        // Instead of null, provide a minimal valid structure
                        cachedStockData[company] = {
                            data: [],
                            industry: industryName,
                            color: industryColors[industryName] || 'rgba(75, 192, 192, 1)',
                            error: true
                        };
                    }
                })();
                loadingPromises.push(promise);
            }
        }
    
        await Promise.all(loadingPromises);
        console.log('Cache initialized');
        return true;
    }
    // Modify createBubbleDataFromCache to ensure all required properties are set
function createBubbleDataFromCache(selectedDate) {
    const bubbleData = [];
    const sectorData = {};
    const expansionFactor = 0.7;
    
    // First pass: Calculate sector data
    Object.entries(cachedStockData).forEach(([company, stockInfo]) => {
        if (!stockInfo || !bubblePositions[company]) return;

        const priceData = stockInfo.data.find(item => item.date === selectedDate);
        const marketCap = priceData ? calculateMarketCap(
            parseFloat(priceData.turnover),
            parseFloat(priceData.turnover_rate),
            parseFloat(priceData.close)
        ) : 0;

        if (marketCap <= 0) return; // Skip invalid market caps

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

    // Make sure each sector has at least one company before creating bubbles
    Object.entries(sectorData).forEach(([industry, data]) => {
        if (data.count > 0) {
            const centerX = data.sumX / data.count;
            const centerY = data.sumY / data.count;
            
            const adjustedX = 50 + (centerX - 50) * expansionFactor;
            const adjustedY = 50 + (centerY - 50) * expansionFactor;

            // Add sector bubble with all required properties
            bubbleData.push({
                x: adjustedX,
                y: adjustedY,
                r: Math.max(Math.sqrt(data.totalMarketCap) * 1.0 * expansionFactor, 1),
                label: industry,
                industry: industry,
                marketCap: data.totalMarketCap,
                backgroundColor: data.color.replace('1)', '0.1)'),
                borderColor: data.color,
                borderWidth: 1,
                isSector: true
            });

            // Add company bubbles
            data.companies.forEach(({ company, marketCap, position }) => {
                if (marketCap > 0) {
                    const adjustedCompanyX = 50 + (position.x - 50) * expansionFactor;
                    const adjustedCompanyY = 50 + (position.y - 50) * expansionFactor;

                    bubbleData.push({
                        x: adjustedCompanyX,
                        y: adjustedCompanyY,
                        r: Math.max(Math.sqrt(marketCap) * 0.7 * expansionFactor, 1),
                        label: companyCodeToName[company] || company,
                        industry: industry,
                        marketCap: marketCap,
                        backgroundColor: data.color.replace('1)', '0.7)'),
                        borderColor: data.color,
                        borderWidth: 1,
                        isSector: false
                    });
                }
            });
        }
    });

    return bubbleData;
}

// Modify drawBubbleChart to ensure proper data handling
function drawBubbleChart(bubbleData, ctx) {
    if (chartInstance) {
        chartInstance.destroy();
    }

    // Ensure we have valid data
    if (!Array.isArray(bubbleData) || bubbleData.length === 0) {
        console.warn('No valid bubble data to display');
        return;
    }

    chartInstance = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                data: bubbleData,
                backgroundColor: d => d.raw.backgroundColor || 'rgba(75, 192, 192, 0.5)',
                borderColor: d => d.raw.borderColor || 'rgba(75, 192, 192, 1)',
                borderWidth: d => d.raw.borderWidth || 1,
                hoverBackgroundColor: d => d.raw.backgroundColor || 'rgba(75, 192, 192, 0.7)',
                hoverBorderColor: d => d.raw.borderColor || 'rgba(75, 192, 192, 1)',
                hoverBorderWidth: d => (d.raw.borderWidth || 1) + 1,
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
                            if (!context.raw) return null;
                            
                            if (context.raw.isSector) {
                                return [
                                    `Sector: ${context.raw.industry || 'Unknown'}`,
                                    `Total Market Cap: $${(context.raw.marketCap || 0).toFixed(2)}B`
                                ];
                            }
                            return [
                                `Company: ${context.raw.label || 'Unknown'}`,
                                `Industry: ${context.raw.industry || 'Unknown'}`,
                                `Market Cap: $${(context.raw.marketCap || 0).toFixed(2)}B`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: false,
                    min: 10,
                    max: 90,
                    grid: {
                        display: false
                    }
                },
                y: {
                    display: false,
                    min: 10,
                    max: 90,
                    grid: {
                        display: false
                    }
                }
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