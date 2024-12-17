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
        d3.csv("datasets/registre-national-installation-production-stockage-electricite grouped.csv"),
        d3.text("datasets/part-regionale-consommation-nationale-couverte-par-filiere.csv").then(text => semicolonCSV.parse(text)),
        d3.text("datasets/conso-nette-regionale.csv").then(text => semicolonCSV.parse(text))
    ];

    const energyTypeContainer = document.querySelector("#energy-type");
    const regionContainer = document.querySelector("#region");

    Promise.all(promise_files).then(function (data) {
        const prod_region = data[0];
        const sites = data[1];
        const cons_region_part_national = data[2];
        const cons_region = data[3];

        /* Prepare map data of regions */
        ctx.mapRegions = {"type": "FeatureCollection", "features": []};
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

        ctx.regionLookup = {
            codeToName: {},
            nameToCode: {}
        };
        ctx.mapRegions.features.forEach(feature => {
            const regionCode = feature.properties.region_code;
            const regionName = feature.properties.region_name;
            ctx.regionLookup.codeToName[regionCode] = regionName;
            ctx.regionLookup.nameToCode[regionName] = regionCode;
        });
        
        ctx.prodRegion = prod_region.features.map(feature => ({
            year: +feature.properties.annee,
            regionCode: feature.properties.code_insee_region,
            regionName: feature.properties.region,
            nuclearGWh: +feature.properties.production_nucleaire || 0,
            nonRenewableGWh: +feature.properties.production_thermique || 0,
            hydroGWh: +feature.properties.production_hydraulique || 0,
            windGWh: +feature.properties.production_eolienne || 0,
            solarGWh: +feature.properties.production_solaire || 0,
            bioenergyGWh: +feature.properties.bioenergies || 0,
            totalGWh: (
                (+feature.properties.production_nucleaire || 0) +
                (+feature.properties.production_thermique || 0) +
                (+feature.properties.production_hydraulique || 0) +
                (+feature.properties.production_eolienne || 0) +
                (+feature.properties.production_solaire || 0) +
                (+feature.properties.bioenergies || 0)
            )
        }));
        console.log(ctx.prodRegion);

        /* Prepare generator sites data with long lat */
        ctx.sitesMap = sites.map(row => ({
            code: row.codeINSEECommune,
            commune: row.commune,
            dept_code: row.codeDepartement,
            dept: row.departement,
            region_code: row.codeRegion,
            region: row.region,
            energy_type: row.filiere,
            sum_max_power_installed: +row.sum_puisMaxInstallee / 1000, // convert MW to GW
            sum_nb_installation: +row.sum_nbInstallations,
            long: row.long, 
            lat: row.lat 
        }));

        // Process national consumption data
        ctx.consRegionPart = cons_region_part_national.map(d => ({
            year: +d["Année"],
            regionCode: d["Code INSEE région"],
            regionName: d["Région"],
            energyType: d["Filière"],
            nationalConsumptionPercentage: parseFloat(d["Part de la consommation nationale couverte (%)"]),
            geoShape: JSON.parse(d["Géo-shape de la région"]),
            geoPoint: d["Géo-point de la région"].split(',').map(Number)
        }));
        // console.log("Processed national installation data:", installationData);

        ctx.consRegion = cons_region.map(d => ({
            year: +d["Année"],
            regionCode: d["Code INSEE région"],
            regionName: d["Région"],
            consumptionNetGWh: +d["Conso_nette_corrigée_TWh"] * 1000, //c convert TWh to GWh
        }));
        console.log(ctx.consRegion);

        ctx.energyType.forEach(type => createFilter("energyType", type, energyTypeContainer));
        populateRegionDropdown(ctx.mapRegions);
        drawMap();
        // Call visualization functions
        // For example: drawMap(svgEl, regionalData);
        drawSankey(ctx.prodRegion, ctx.consRegionPart);

        drawTreeMap(ctx.sitesMap, ctx.currentFilters);
        drawLineChart();
    }).catch(function (error) {
        console.error("Error loading data:", error);
    });
};

function drawMap() {
    //TODO
    // draw France map with its regions
    ctx.LFmap = L.map('mapContainer', {
        minZoom: 6, // Minimum zoom level to avoid zooming too far out
        maxZoom: 10, // Maximum zoom level
        maxBoundsViscosity: 1, // Ensures the map sticks within the bounds
    });

    L.DomUtil.addClass(ctx.LFmap._container, 'crosshair-cursor-enabled');

    L.esri.basemapLayer("Gray", {
        detectRetina: true,
        attribution: ctx.ATTRIB
    }).addTo(ctx.LFmap);

    ctx.LFmap.setView([46.603354, 1.888334], 6); // Center on France with a zoom level of 6

    // ctx.clicked = false;
    const regionLayer = L.geoJson(ctx.mapRegions, {
        style: style,
        onEachFeature: function(feature, layer) {
            layer.on({
                mouseover: function(e) {
                    highlightFeature(e);
                    // if (!isMouseOverSite) {
                    //     highlightFeature(e);
                    // }
                },
                mouseout: function(e) {
                    resetHighlight(e);
                },
                click: function(e) {
                    if (!ctx.clicked || e.target.feature.properties.region_code !== ctx.zoomedRegion) {
                        zoomToFeature(e);
                        ctx.clicked = true;
                        ctx.zoomedRegion = e.target.feature.properties.region_code
                    } else {
                        zoomOutMap(e);
                        ctx.clicked = false
                    }
                }
            });
        }
    }).addTo(ctx.LFmap);

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
    ctx.selectedRegionCode = layer.feature.properties.region_code;
    // console.log(ctx.selectedRegionCode);
    ctx.LFmap.fitBounds(layer.getBounds());
};

function zoomOutMap(e) {
    const layer = e.target;
    ctx.selectedRegionCode = layer.feature.properties.region_code;
    // console.log(ctx.selectedRegionCode);
    // ctx.LFmap.fitBounds(layer.getBounds());
    ctx.LFmap.setView([46.603354, 1.888334], 6);
};

function highlightFeature(e, data) {
    const layer = e.target;
    layer.setStyle({
        fillColor: "lightyellow",
        weight: 4,
        opacity: 1,
        color: "#666",
        dashArray: '5',
        fillOpacity: 0.8
    });
    showRegionTooltip(e.target.feature.properties.region_code, e.pageX, e.pageY);
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
    hideTooltip();
};

function plotSites() {
    const groupedSites = groupSitesByCommune(ctx.sitesMap);

    filteredSites = ctx.sitesMap.filter(d => d.sum_max_power_installed >= 1); // only plot power >= 1 GWh
    let maxPowerExt = d3.extent(ctx.sitesMap, d => d.sum_max_power_installed);
    ctx.rScale = d3.scalePow()
        .domain(maxPowerExt)
        .range([2, 25]);
    let siteSelection = d3.select("g#sites")
        .selectAll("circle")
        .data(filteredSites);

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
            const siteDetails = communeSites.map(site => `${site.energy_type}: ${site.sum_max_power_installed.toFixed(2)} GW`).join("<br>");
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

function drawTreeMap(data, filters) {
    d3.select("#treeMap").selectAll("*").remove();
    const filteredData = data.filter(d => {
        const energyMatch = filters.energyType.length === 0 || filters.energyType.includes(d.energy_type);
        const regionMatch =  filters.region.length === 0 || d.region_code == ctx.regionLookup.nameToCode[filters.region];
        return energyMatch && regionMatch;
    });

    console.log(filteredData);
    const groupedData = d3.group(filteredData, d => d.energy_type);

    // Compute the total max power installed for the selected energy type
    const totalMaxPower = d3.sum(filteredData, d => d.sum_max_power_installed);

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
        .tile(d3.treemapSquarify)
        .size([width, height])
        .padding(1)
        .round(true)(root);
  
    // Create SVG container
    const svg = d3.select("#treeMap")
        .html("")
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
        .attr("height", d => d.y1 - d.y0)
        .style("opacity", 0)
        .transition()
        .duration(500)
        .style("opacity", 1);

  
    // Add tooltips
    leaf.append("title")
        .text(d => `${d.data.name}\n${d.data.value.toFixed(2)} GW`);
  
    // Add text labels
    leaf.append("text")
        .selectAll("tspan")
        .data(d => [d.data.name, `${d.data.percentage.toFixed(2)}%`])
        .join("tspan")
        .attr("x", 3)
        .attr("y", (d, i) => `${1.1 + i * 0.9}em`)
        .attr("fill-opacity", (d, i) => i === 1 ? 0.7 : null)
        .text(d => d);
};

function drawLineChart() {
    const width = 928;
    const height = 600;
    const marginTop = 20;
    const marginRight = 20;
    const marginBottom = 30;
    const marginLeft = 30;

    // Create the positional scales.
    const x = d3.scaleLinear()
        .domain(d3.extent(ctx.prodRegion, d => d.year))
        .range([marginLeft, width - marginRight]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(ctx.prodRegion, d => d.totalGWh)]).nice()
        .range([height - marginBottom, marginTop]);

    const svg = d3.select("#lineChart")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto; overflow: visible; font: 10px sans-serif;");      
    
    // Add the horizontal axis.
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0));

    // Add the vertical axis.
    svg.append("g")
        .attr("transform", `translate(${marginLeft},0)`)
        .call(d3.axisLeft(y))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").clone()
            .attr("x2", width - marginLeft - marginRight)
            .attr("stroke-opacity", 0.1))
        .call(g => g.append("text")
            .attr("x", -marginLeft)
            .attr("y", 10)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .text("↑ Total Production (GWh)"));

    ctx.prodRegion.sort((a, b) => d3.ascending(a.year, b.year));

    // Compute the points in pixel space as [x, y, z], where z is the name of the series.
    const points = ctx.prodRegion.map((d) => [x(d.year), y(d.totalGWh), d.regionName]);

    // Group the points by series.
    const groups = d3.rollup(points, v => Object.assign(v, {z: v[0][2]}), d => d[2]);

    // Draw the lines.
    const line = d3.line();
    const path = svg.append("g")
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 1.5)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .selectAll("path")
        .data(groups.values())
        .join("path")
        .style("mix-blend-mode", "multiply")
        .attr("d", line);
    // Add an invisible layer for the interactive tip.
    const dot = svg.append("g")
        .attr("display", "none");

    dot.append("circle")
        .attr("r", 2.5);

    dot.append("text")
        .attr("text-anchor", "middle")
        .attr("y", -8);

    svg
        .on("pointerenter", pointerentered)
        .on("pointermove", pointermoved)
        .on("pointerleave", pointerleft)
        .on("touchstart", event => event.preventDefault());

    return svg.node();

    function pointermoved(event) {
        const [xm, ym] = d3.pointer(event);
        const i = d3.leastIndex(points, ([x, y]) => Math.hypot(x - xm, y - ym));
        const [x, y, k] = points[i];
        // const hoveredYear = xScale.invert(x);
        const dataPoint = ctx.prodRegion.find(d => d.regionName === k && d.year === y);
        console.log(dataPoint);
        // const dataPoint = ctx.prodRegion.find(d => d.regionName === k && x === xScale(d.year));

        path.style("stroke", ({z}) => z === k ? null : "#ddd").filter(({z}) => z === k).raise();
        dot.attr("transform", `translate(${x},${y})`);
        dot.select("text").text(`${k}`);
        // svg.property("value", ctx.prodRegion.totalGWh[i]).dispatch("input", {bubbles: true});
        // svg.property("value", dataPoint ? dataPoint.totalGWh : null).dispatch("input", {bubbles: true});

    }

    function pointerentered() {
        path.style("mix-blend-mode", null).style("stroke", "#ddd");
        dot.attr("display", null);
    }

    function pointerleft() {
        path.style("mix-blend-mode", "multiply").style("stroke", null);
        dot.attr("display", "none");
        svg.node().value = null;
        svg.dispatch("input", {bubbles: true});
    }
};