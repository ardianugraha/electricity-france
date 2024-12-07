// Define context with map dimensions and a year filter
const ctx = {
    MAP_W: 1024,
    MAP_H: 1024,
    YEAR: "2020",
};

// Initialize the visualization
function createViz() {
    console.log("Using D3 v" + d3.version);

    // Create an SVG element for the map
    const svgEl = d3.select("#mapContainer").append("svg")
        .attr("width", ctx.MAP_W)
        .attr("height", ctx.MAP_H);

    // Load and process data
    loadData(svgEl);

    // TODO: Call draw functions for visualizations
    // drawMap();
    // drawSankey();
    // drawRegression();
    // drawCapDistribution();
}

// Load data from multiple CSV files and process it
function loadData(svgEl) {
    // Define a custom parser for semicolon-delimited CSV files
    const semicolonCSV = d3.dsvFormat(";");

    // Load data from files
    const promiseFiles = [
        d3.text("datasets/part-regionale-consommation-nationale-couverte-par-filiere.csv").then(text => semicolonCSV.parse(text)),
        d3.text("datasets/registre-national-installation-production-stockage-electricite-agrege.csv").then(text => semicolonCSV.parse(text)),
    ];

    // Process data when both files are loaded
    Promise.all(promiseFiles).then(function ([partRegionalData, registreNationalData]) {
        // Process regional consumption data
        const regionalData = partRegionalData.map(d => ({
            year: +d["Année"],
            regionCode: d["Code INSEE région"],
            regionName: d["Région"],
            energyType: d["Filière"],
            nationalConsumptionPercentage: parseFloat(d["Part de la consommation nationale couverte (%)"]),
            geoShape: JSON.parse(d["Géo-shape de la région"]),
            geoPoint: d["Géo-point de la région"].split(',').map(Number)
        }));
        console.log("Processed regional consumption data:", regionalData);

        // Process national installation data
        const installationData = registreNationalData.map(d => ({
            installationName: d["nomInstallation"],
            regionCode: d["codeRegion"],
            regionName: d["region"],
            filiere: d["filiere"],
            maxPower: parseFloat(d["maxPuis"]) || null,
            commissioningDate: d["dateMiseEnservice"]
        }));
        console.log("Processed national installation data:", installationData);

        // Call visualization functions
        // For example: drawMap(svgEl, regionalData);
    }).catch(function (error) {
        console.error("Error loading data:", error);
    });
}

// Placeholder: Draw the map of France with its regions
function drawMap(svgEl, data) {
    // TODO: Implement map drawing using D3
    console.log("Drawing map with data:", data);
}

// Placeholder: Draw a Sankey diagram for energy flow
function drawSankey(data) {
    // TODO: Implement Sankey diagram drawing
    console.log("Drawing Sankey diagram with data:", data);
}

// Placeholder: Draw regression analysis
function drawRegression(data) {
    // TODO: Implement regression analysis visualization
    console.log("Drawing regression with data:", data);
}

// Placeholder: Draw capacity distribution
function drawCapDistribution(data) {
    // TODO: Implement capacity distribution visualization
    console.log("Drawing capacity distribution with data:", data);
}

// Call createViz to initialize the visualization
createViz();
