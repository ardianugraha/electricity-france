// Define context with map dimensions and a year filter
const ctx = {
    // MAP_W: 1024,
    // MAP_H: 1024,
    SANKEY_W: 700, SANKEY_H: 700,
    ATTRIB: '<a href="https://linkedin.com/in/ardianugraha">Nugraha</a> & <a href="https://linkedin.com/in/matin-zivdar">Zivdar</a> (<a href="https://www.enseignement.polytechnique.fr/informatique/CSC_51052/">CSC_51052_EP</a>) | Map &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, Data &copy; <a href="https://data.enedis.fr">Enedis</a> & <a href="https://odre.opendatasoft.com/">ODRE</a>',
    LFmap: null,
    energyType: [
        'Nuclear',
        'Hydro', 
        'Wind', 
        'Solar', 
        'Bioenergy', 
        'Marine Energy', 
        'Geothermal',
        'Non-renewable',
        'Storage',
        'Other'
    ],
    colorMapping: {
        "Bioenergy": "#6B3F2A",   // Dark brown
        "Marine Energy": "#003366", // Dark blue
        "Wind": "#87CEEB",         // Sky blue
        "Geothermal": "#FFA500",     // Orange
        "Hydro": "#4682B4",    // Steel blue
        "Nuclear": "#D32F2F",      // Red
        "Solar": "#e8c33c",         // Yellow
        "Non-renewable": "black",
        "Storage": "silver",
        "Other": "darkgray",
    },
    currentFilters: {
        energyType: [],
        region: []
    }
};

// Initialize the visualization
function createViz() {
    console.log("Using D3 v" + d3.version);
    loadData();
    // TODO 
    // call draw functions here
};

function loadData() {
    // Define a custom parser for semicolon-delimited CSV files
    const semicolonCSV = d3.dsvFormat(";");

    const promise_files = [
        d3.json("datasets/prod-region-annuelle-filiere.geojson"),
        d3.json("datasets/production-electrique-par-filiere-a-la-maille-departement.geojson"),
        d3.csv("datasets/registre-national-installation-production-stockage-electricite grouped.csv"),
        d3.text("datasets/part-regionale-consommation-nationale-couverte-par-filiere.csv").then(text => semicolonCSV.parse(text)),
    ];

    const energyTypeContainer = document.querySelector("#energy-type");
    const regionContainer = document.querySelector("#region");

    Promise.all(promise_files).then(function (data) {
        const prod_region = data[0];
        const prod_dept = data[1];
        const sites = data[2];
        const regionConsumption = data[3];

        // console.log(sites);
        // console.log(prod_region);
        // console.log(prod_dept);

        /* Prepare map data of regions */
        ctx.mapRegions = {"type": "FeatureCollection", "features": []};
        ctx.prodDataRegions = {}
        prod_region.features.forEach(feature => {
            let region_code = feature.properties.code_insee_region
            let exists = ctx.mapRegions.features.some(i => i.properties.region_code == region_code);
            if(!exists) {
                ctx.mapRegions.features.push({
                    "type": "Feature",
                    "geometry": feature.geometry,
                    "properties": {
                        "region_code": region_code,
                        "region_name": feature.properties.region
                    }
                })
            };
        });
        
        regionProductionData = prod_region.features.map(feature => ({
            year: +feature.properties.annee,
            regionCode: feature.properties.code_insee_region,
            regionName: feature.properties.region,
            nuclear: feature.properties.production_nucleaire,
            thermique: feature.properties.production_thermique,
            hydraulique: feature.properties.production_hydraulique,
            eolienne: feature.properties.production_eolienne,
            solaire: feature.properties.production_solaire,
            bioenergies: feature.properties.bioenergies,
        }));
        // console.log(ctx.regionProductionData);

        /* Prepare generator sites data with long lat */
        ctx.sitesMap = sites.map(row => ({
                            code: row.codeINSEECommune,
                            commune: row.commune,
                            energy_type: row.filiere,
                            sum_max_power_installed: +row.sum_puisMaxInstallee,
                            sum_nb_installation: +row.sum_nbInstallations,
                            long: row.long, 
                            lat: row.lat 
                        }));

        ctx.energyType.forEach(type => createFilter("energyType", type, energyTypeContainer));

        drawMap();

        // Process national consumption data
        const regionalConsumptionData = regionConsumption.map(d => ({
            year: +d["Année"],
            regionCode: d["Code INSEE région"],
            regionName: d["Région"],
            energyType: d["Filière"],
            nationalConsumptionPercentage: parseFloat(d["Part de la consommation nationale couverte (%)"]),
            geoShape: JSON.parse(d["Géo-shape de la région"]),
            geoPoint: d["Géo-point de la région"].split(',').map(Number)
        }));
        // console.log("Processed national installation data:", installationData);

        // Call visualization functions
        // For example: drawMap(svgEl, regionalData);
        drawSankey(regionProductionData, regionalConsumptionData);

        createTreeMap(ctx.sitesMap, ctx.currentFilters);
    }).catch(function (error) {
        console.error("Error loading data:", error);
    });
};

function drawMap() {
    //TODO
    // draw France map with its regions
    ctx.LFmap = L.map('mapContainer', {
        minZoom: 6, // Minimum zoom level to avoid zooming too far out
        maxZoom: 12, // Maximum zoom level
        maxBoundsViscosity: 1, // Ensures the map sticks within the bounds
    });

    L.DomUtil.addClass(ctx.LFmap._container, 'crosshair-cursor-enabled');

    L.esri.basemapLayer("Gray", {
        detectRetina: true,
        attribution: ctx.ATTRIB
    }).addTo(ctx.LFmap);

    ctx.LFmap.setView([46.603354, 1.888334], 6); // Center on France with a zoom level of 6

    // const regionLayer = L.geoJson(ctx.mapRegions, {
    //     style: style,
    //     onEachFeature: function(feature, layer) {
    //         layer.on({
    //             mouseover: function(e) {
    //                 if (!isMouseOverSite) {
    //                     highlightFeature(e);
    //                 }
    //             },
    //             mouseout: function(e) {
    //                 resetHighlight(e);
    //             },
    //             click: function(e) {
    //                 zoomToFeature(e);
    //             }
    //         });
    //     }
    // }).addTo(ctx.LFmap);

    L.svg().addTo(ctx.LFmap);
    let svgEl = d3.select("#mapContainer").select("svg");
    svgEl.select("g").attr("id", "sites");

    plotSites();
    ctx.LFmap.on('zoom', function () { plotSites(); });

};

function style(feature) {
    return {
        fillColor: "lightyellow",
        weight: 2,
        opacity: 1,
        color: "white",
        dashArray: '3',
        fillOpacity: 0.3
    };
};

function zoomToFeature(e) {
    const layer = e.target;
    ctx.selectedRegionCode = e.target.feature.properties.region_code;
    // console.log(ctx.selectedRegionCode);
    ctx.LFmap.fitBounds(layer.getBounds());
};

function highlightFeature(e) {
    const layer = e.target;
    layer.setStyle({
        fillColor: "lightyellow",
        weight: 2,
        opacity: 1,
        color: "#666",
        dashArray: '3',
        fillOpacity: 0.3
    });
    layer.bringToFront();
};

function resetHighlight(e) {
    const layer = e.target;
    layer.setStyle({
        fillColor: "lightyellow",
        weight: 2,
        opacity: 1,
        color: "white",
        dashArray: '3',
        fillOpacity: 0.3
    });
    layer.bringToBack();
};

function plotSites() {
    const groupedSites = groupSitesByCommune(ctx.sitesMap);

    let maxPowerExt = d3.extent(ctx.sitesMap, d => d.sum_max_power_installed);
    ctx.rScale = d3.scalePow()
        .domain(maxPowerExt)
        .range([2, 15]);
    let siteSelection = d3.select("g#sites")
        .selectAll("circle")
        .data(ctx.sitesMap);

    // Enter: Add new circles for sites
    siteSelection.enter()
        .append("circle")
        .attr("cx", d => ctx.LFmap.latLngToLayerPoint([d.lat, d.long]).x)
        .attr("cy", d => ctx.LFmap.latLngToLayerPoint([d.lat, d.long]).y)
        .attr("r", d => ctx.rScale(d.sum_max_power_installed))
        .attr("class", d => d.energy_type.replace(/\s+/g, '-')) // Class based on energy_type
        .style("fill", d => ctx.colorMapping[d.energy_type])
        .style("opacity", 0.7)
        .style("pointer-events", "auto") 
        .on("mouseover", function(event, d) {
            const communeSites = groupedSites[d.commune];
            const siteDetails = communeSites.map(site => `${site.energy_type}: ${site.sum_max_power_installed} MW`).join("<br>");
            showCommuneTooltip(d.commune, siteDetails, event.pageX, event.pageY);
        })
        .on("mouseout", hideTooltip)
        .on("click", function(event, d) {
            event.stopPropagation();
            console.log("site clicked:", d);
        });

    // Update: Adjust positions and sizes
    siteSelection
        .attr("cx", d => ctx.LFmap.latLngToLayerPoint([d.lat, d.long]).x)
        .attr("cy", d => ctx.LFmap.latLngToLayerPoint([d.lat, d.long]).y)
        .attr("r", d => ctx.rScale(d.sum_max_power_installed));

    siteSelection.exit().remove();
};

function drawSankey(regionProductionData, regionalConsumptionData) {
    // TODO: Implement Sankey diagram drawing
    console.log("Drawing Sankey diagram");
    // Prepare data for Sankey diagram
    const sankey = d3.sankey()
        .nodeWidth(15)
        .nodePadding(10)
        .size([ctx.SANKEY_W, ctx.SANKEY_H]);

    // Collect unique regions, energy types, and links
    const regions = new Set();
    const energyTypes = new Set(["nuclear", "thermique", "hydraulique", "eolienne", "solaire", "bioenergie"]);
    const links = [];

    // Process production data to create first set of links
    const productionByRegionAndType = {};

    regionProductionData.forEach(prod => {
        if (prod.year === 2020) {
            regions.add("production-" + prod.regionName);

            energyTypes.forEach(field => {
                value = parseFloat(prod[field]);
                // Create links from production regions to energy types
                if (value > 0) {
                    links.push({
                        source: "production-" + prod.regionName,
                        target: field,
                        value: value
                    });
                }
            });
        }
    });

    // Normalize energy type
    const energyTypesMap = {
        'nucléaire': 'nuclear',
        'thermique fossile': 'thermique',
        'hydraulique': 'hydraulique',
        'éolien': 'eolienne',
        'solaire': 'solaire',
        'bioénergies': 'bioenergie'
    };

    // TODO: Fix consumption!
    // TODO: Add a year selection field
    // Process consumption data to create links from energy types to consumption regions
    regionalConsumptionData.forEach(cons => {
        if (cons.year === 2020) {

            const normalizedEnergyType = energyTypesMap[cons.energyType];

            // Only add if the energy type exists in our production data
            if (energyTypes.has(normalizedEnergyType)) {
                regions.add("consumption-" + cons.regionName);
                
                const consumptionValue = parseFloat(cons.nationalConsumptionPercentage);
                
                if (consumptionValue > 0) {
                    links.push({
                        source: normalizedEnergyType,
                        target: "consumption-" + cons.regionName,
                        value: consumptionValue
                    });
                }
            }
        }
    });

    // Combine and sort unique nodes
    const allNodes = Array.from(new Set([...regions, ...energyTypes]));

    // Create node index map
    const nodeIndices = new Map(allNodes.map((node, i) => [node, i]));

    // Prepare Sankey links with node indices
    const sanKeyLinks = links.map(link => ({
        source: nodeIndices.get(link.source),
        target: nodeIndices.get(link.target),
        value: link.value
    })).filter(link => 
        link.source !== undefined && 
        link.target !== undefined && 
        link.value > 0
    );

    // Create Sankey graph
    const graph = sankey({
        nodes: allNodes.map(d => ({ name: d })),
        links: sanKeyLinks
    });

    console.log(graph)

    // Remove any existing SVG first
    d3.select("#sankeyContainer").selectAll("*").remove();

    // Create SVG dynamically
    const svg = d3.select("#sankeyContainer")
        .append("svg")
        .attr("width", ctx.SANKEY_W)
        .attr("height", ctx.SANKEY_H);

    // Color scale for nodes
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // TODO:
    // Add margin

    // Append links
    svg.append("g")
        .attr("class", "links")
        .selectAll("path")
        .data(graph.links)
        .enter().append("path")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke", function (d) {
            // TODO:
            // return extractRegion(graph.nodes[d.source.index]['name']);
            return 'black';
        })
        .attr("stroke-opacity", 0.5)
        .attr("stroke-width", d => Math.max(1, d.width));

    // Append nodes
    const node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("rect")
        .data(graph.nodes)
        .enter().append("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => color(d.name))
        .attr("opacity", 0.8);

    // Add node labels
    svg.append("g")
        .attr("class", "node-labels")
        .selectAll("text")
        .data(graph.nodes)
        .enter().append("text")
        .attr("x", d => (d.x0 + d.x1) / 2)
        .attr("y", d => (d.y0 + d.y1) / 2)
        .attr("dy", "1.35em")
        .attr("text-anchor", "middle")
        .text(d => extractRegion(d.name))
        .attr("font-size", "10px")
        .attr("fill", "black");

    // Logging for debugging
    // console.log("Nodes:", allNodes);
    // console.log("Links:", links);
    // console.log("Sankey Links:", sanKeyLinks);
};

function drawRegression() {

};

function drawCapDistribution() {

};

function createTreeMap(data, selectedEnergyType) {
    // Filter data based on the selected energy type
    console.log(data);
    const filteredData = data;
    // data.filter(d => d.energy_type === selectedEnergyType);
    const groupedData = d3.group(filteredData, d => d.energy_type);

    // Compute the total max power installed for the selected energy type
    const totalMaxPower = d3.sum(filteredData, d => d.sum_max_power_installed);
    console.log(totalMaxPower);
    // Transform data into hierarchical format for treemap
    const hierarchyData = {
        name: "root",
        children: Array.from(groupedData, ([key, values]) => {
          const totalPower = d3.sum(values, d => d.sum_max_power_installed);
          return {
            name: key,
            value: totalPower,
            percentage: totalPower / d3.sum(filteredData, d => d.sum_max_power_installed) * 100
          };
        })
      };

    console.log(hierarchyData);
    // Specify dimensions
    const width = 600;
    const height = 300;
  
    // Create color scale
    const color = d3.scaleOrdinal()
      .domain(filteredData.map(d => d.energy_type))
      .range(d3.schemeTableau10);
  
    // Compute treemap layout
    const root = d3.hierarchy(hierarchyData)
      .sum(d => d.value)
      .sort((a, b) => b.value - a.value);
  
    d3.treemap()
      .size([width, height])
      .padding(1)
      .round(true)(root);
  
    // Create SVG container
    const svg = d3.select("#treeMap") // Replace with your container's selector
    //   .html("") // Clear any previous content
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", width)
      .attr("height", height)
      .attr("style", "font: 10px sans-serif;");
  
    // Create a group for each leaf node
    const leaf = svg.selectAll("g")
      .data(root.leaves())
      .join("g")
      .attr("transform", d => `translate(${d.x0},${d.y0})`);
  
    // Add rectangles
    leaf.append("rect")
      .attr("fill", d => ctx.colorMapping[d.data.name])
      .attr("fill-opacity", 0.6)
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0);
  
    // Add tooltips
    leaf.append("title")
      .text(d => `${d.data.name}\n${d.data.percentage.toFixed(2)}%`);
  
    // Add text labels
    leaf.append("text")
      .selectAll("tspan")
      .data(d => [d.data.name, `${d.data.percentage.toFixed(2)}%`])
      .join("tspan")
      .attr("x", 3)
      .attr("y", (d, i) => `${1.1 + i * 0.9}em`)
      .attr("fill-opacity", (d, i) => i === 1 ? 0.7 : null)
      .text(d => d);
  }