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



    function loadStockData(industryName) {
        // Load company names from provided GICS industry data
        const stockFiles = gicsIndustryData[industryName].map(stock => `${stock}.json`);
        const stockDataPromises = stockFiles.map(async (fileName, index) => {
            const stockFilePath = `data/GICS_Stock_Data/${industryName}/${fileName}`;
            const response = await fetch(stockFilePath);
            if (!response.ok) {
                throw new Error(`Failed to load file: ${fileName}`);
            }
            const data = await response.json();
            return data.map(entry => ({ ...entry, company: gicsIndustryData[industryName][index] }));
        });

        Promise.all(stockDataPromises)
            .then(stockDataArrays => {
                const selectedDate = dates[timeline.value];
                const combinedData = stockDataArrays.map(stockData => {
                    const entry = stockData.find(item => item.date === selectedDate);
                    return {
                        company: stockData[0].company,
                        company_name: companyCodeToName[stockData[0].company],
                        close: entry ? entry.close : null
                    };
                });
                displayChart(stockDataArrays, combinedData, industryName);
            })
            .catch(error => console.error('Error loading stock data:', error));
    }


    const industryList = document.getElementById('industry-list');
    const industryLinks = industryList.querySelectorAll('a');
    const mainViewer = document.getElementById('main-viewer');
    let chartInstance = null;

    function displayChart(stockDataArrays, stockData, industryName) {
        // Extract data for chart
        const labels = stockData.map(data => data.company);
        const names = stockData.map(data => data.company_name);
        const stockPrices = stockData.map(data => data.close);

        // Clear the previous chart if it exists
        if (chartInstance) {
            chartInstance.destroy();
        }

        // Clear the main viewer
        mainViewer.innerHTML = '';

        const baseColor = industryColors[industryName] || 'rgba(75, 192, 192, 0.2)';
        const colorVariation = (index, total) => {
            const hue = (index / total) * 200 + 160;
            return `hsl(${hue}, 60%, 70%, 0.8)`;
        };

        // Create new bar chart
        const barCtx = document.createElement('canvas');
        barCtx.style.height = '200px';
        barCtx.style.marginBottom = '150px';
        mainViewer.appendChild(barCtx);

        chartInstance = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: labels,
                names: names,
                datasets: [{
                    label: `capitalization on ${dates[timeline.value]}`,
                    data: stockPrices,
                    backgroundColor: stockData.map(() => industryColors[industryName] || 'rgba(75, 192, 192, 0.2)'),
                    borderColor: stockData.map(() => (industryColors[industryName] || 'rgba(75, 192, 192, 0.2)').replace('0.2', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                animation: {
                    duration: 0, // Adjust the duration for a smoother animation
                    easing: 'easeOutBounce' // Use a smooth easing function
                },
                scales: {
                    x: {
                        beginAtZero: true
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        const lineCtx = document.createElement('canvas');
        lineCtx.style.marginTop = '200px';
        lineCtx.style.height = '400px';
        mainViewer.appendChild(lineCtx);
        // Prepare data for line chart
        const lineLabels = dates.slice(0, parseInt(timeline.value) + 10).map(date => new Date(date));
        const lineTimes = dates.slice(0, parseInt(timeline.value) + 10);
        const lineDatasets = stockDataArrays.map((stockData, index, array) => {
            return {
                label: companyCodeToName[stockData[0].company] || stockData[0].company,
                data: lineLabels.map(date => {
                    const entry = stockData.find(item => new Date(item.date).getTime() === date.getTime());
                    return entry ? entry.close : null;
                }),
                fill: false,
                borderColor: colorVariation(index, array.length),
                tension: 0.1
            };
        });

        // Create new line chart
        lineChartInstance = new Chart(lineCtx, {
            type: 'line',
            animation: {
                duration: 0, // Adjust the duration for a smoother animation
                easing: 'linear' // Use a smooth easing function
            },

            data: {
                labels: lineTimes,
                datasets: lineDatasets
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
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

            // Load stock data for the selected industry
            loadStockData(industryName);
        });
    });

    // Add event listener to update the bar chart when the timeline slider changes
    timeline.addEventListener('input', function () {
        if (chartInstance) {
            const industryName = document.querySelector('a[style="color: orange;"]').textContent;
            loadStockData(industryName);
        }
    });





});