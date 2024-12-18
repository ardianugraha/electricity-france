// Define context with map dimensions and a year filter
const ctx = {
    // MAP_W: 1024,
    // MAP_H: 1024,
    SANKEY_W: 1200, SANKEY_H: 700, SANKEY_MARGIN: {top: 10, right: 10, bottom: 10, left: 10},
    SCATTER_W:650, SCATTER_H: 600, SCATTER_MARGIN: {top: 20, right: 100, bottom: 60, left: 50},
    ATTRIB: '<a href="https://linkedin.com/in/ardianugraha">Nugraha</a> & <a href="https://linkedin.com/in/matin-zivdar">Zivdar</a> (<a href="https://www.enseignement.polytechnique.fr/informatique/CSC_51052/">CSC_51052_EP</a>) | Map &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, Data &copy; <a href="https://data.enedis.fr">Enedis</a> & <a href="https://odre.opendatasoft.com/">ODRE</a>',
    LFmap: null,
    energyType: [
        'Nuclear',
        'Hydro', 
        'Wind', 
        'Solar', 
        'Bioenergy', 
        'Non-renewable',
        'Marine Energy', 
        'Geothermal',
        // 'Storage',
        // 'Other'
    ],
    colorMapping: {
        "Bioenergy": "#6B3F2A",   // Dark brown
        "Wind": "#87CEEB",         // Sky blue
        "Hydro": "#4682B4",    // Steel blue
        "Nuclear": "#D32F2F",      // Red
        "Solar": "#e8c33c",         // Yellow
        "Non-renewable": "black",
        "Marine Energy": "#003366", // Dark blue
        "Geothermal": "#FFA500",     // Orange
        // "Storage": "silver",
        // "Other": "darkgray",
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
        d3.csv("datasets/part-regionale-consommation-nationale-couverte-par-filiere copy.csv"),
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
            bioenergyGWh: +feature.properties.production_bioenergies || 0,
            totalGWh: (
                (+feature.properties.production_nucleaire || 0) +
                (+feature.properties.production_thermique || 0) +
                (+feature.properties.production_hydraulique || 0) +
                (+feature.properties.production_eolienne || 0) +
                (+feature.properties.production_solaire || 0) +
                (+feature.properties.bioenergies || 0)
            )
        }));
        // console.log("ctx.prodRegion:", ctx.prodRegion);

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
        }))
        .filter(row => 
            !['Other', 'Storage'].includes(row.energy_type)
        );
        // console.log("ctx.sitesMap:", ctx.sitesMap);

        // Process national consumption data
        ctx.consRegionPart = cons_region_part_national.map(d => ({
            year: +d["Année"],
            regionCode: d["Code INSEE région"],
            regionName: d["Région"],
            energyType: d["Filière"],
            nationalConsumptionPercentage: parseFloat(d["Part de la consommation nationale couverte (%)"]),
            filiere_consGWh: parseFloat(d["filiere_consGWh"])
        }));

        ctx.consRegion = cons_region.map(d => ({
            year: +d["Année"],
            regionCode: d["Code INSEE région"],
            regionName: d["Région"],
            consumptionNetGWh: +d["Conso_nette_corrigée_TWh"] * 1000, //c convert TWh to GWh
        }));

        ctx.energyType.forEach(type => createFilter("energyType", type, energyTypeContainer));
        populateRegionDropdown(ctx.mapRegions);
        drawMap();
        // Call visualization functions
        // For example: drawMap(svgEl, regionalData);
        drawSankey(ctx.prodRegion, ctx.consRegionPart);
        drawScatter();

        drawTreeMapSite(ctx.sitesMap, ctx.currentFilters);
        drawTreeMapProd(ctx.prodRegion, ctx.currentFilters);

        drawLineChart();
    }).catch(function (error) {
        console.error("Error loading data:", error);
    });
};

function drawMap() {
    //TODO
    // draw France map with its regions
    ctx.LFmap = L.map('mapContainer', {
        minZoom: 5, // Minimum zoom level to avoid zooming too far out
        maxZoom: 10, // Maximum zoom level
        maxBoundsViscosity: 1, // Ensures the map sticks within the bounds
    });

    L.DomUtil.addClass(ctx.LFmap._container, 'crosshair-cursor-enabled');

    L.esri.basemapLayer("Gray", {
        detectRetina: true,
        attribution: ctx.ATTRIB
    }).addTo(ctx.LFmap);

    ctx.LFmap.setView([46.603354, 2.3], 6); // Center on France with a zoom level of 6

    // ctx.clicked = false;
    const regionLayer = L.geoJson(ctx.mapRegions, {
        style: styleRegion,
        onEachFeature: function(feature, layer) {
            layer.on({
                mouseover: function(e) {
                    highlightRegion(e);
                    // if (!isMouseOverSite) {
                    //     highlightFeature(e);
                    // }
                },
                mouseout: function(e) {
                    resetHighlightRegion(e);
                },
                click: function(e) {
                    if (!ctx.clicked || e.target.feature.properties.region_code !== ctx.zoomedRegion) {
                        zoomToRegion(e);
                        handleRegionClick(e.target.feature.properties.region_code);
                        ctx.clicked = true;
                        ctx.zoomedRegion = e.target.feature.properties.region_code;
                    } else {
                        zoomOutMap(e);
                        ctx.clicked = false;
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

function styleRegion(feature) {
    return {
        fillColor: "lightyellow",
        weight: 2,
        opacity: 1,
        color: "white",
        dashArray: '3',
        fillOpacity: 0.3
    };
};

function zoomToRegion(e) {
    const layer = e.target;
    ctx.selectedRegionCode = layer.feature.properties.region_code;
    // console.log(ctx.selectedRegionCode);
    ctx.LFmap.fitBounds(layer.getBounds());
};

function zoomOutMap(e) {
    const layer = e.target;
    ctx.selectedRegionCode = layer.feature.properties.region_code;
    ctx.LFmap.setView([46.603354, 2.3], 6);
};

function highlightRegion(e, data) {
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

function resetHighlightRegion(e) {
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

function drawSankey() {
    // TODO: Implement Sankey diagram drawing
    console.log("Drawing Sankey diagram");
    // Prepare data for Sankey diagram
    const sankey = d3.sankey()
        .nodeWidth(ctx.SANKEY_W / 15)
        .nodePadding(10)
        .size([ctx.SANKEY_W, ctx.SANKEY_H]);

    // Collect unique regions, energy types, and links
    const regions = new Set();
    const links = [];

    // Process production data to create first set of links
    const productionByRegionAndType = {};

    ctx.prodRegion.forEach(prod => {
        if (prod.year === 2020) {
            regions.add("production-" + prod.regionName);

            for (const [key, value] of Object.entries(prod)) {
                if (key.includes('GWh') & findStr(ctx.energyType, key.slice(0, -3))) {
                    // Create links from production regions to energy types
                    if (value > 0) {
                        links.push({
                            source: "production-" + prod.regionName,
                            target: capitalizeFirstLetter(key.slice(0, -3)),
                            value: value
                        });
                    }
                } else if (key == "nonRenewableGWh") {
                    // Create links from production regions to energy types
                    if (value > 0) {
                        links.push({
                            source: "production-" + prod.regionName,
                            target: "Non-renewable",
                            value: value
                        });
                    }
                }
            };
        }
    });

    // Normalize energy type
    const energyTypesMap = {
        'nucléaire': ctx.energyType[0],
        'thermique fossile': ctx.energyType[7],
        'hydraulique': ctx.energyType[1],
        'éolien': ctx.energyType[2],
        'solaire': ctx.energyType[3],
        'bioénergies': ctx.energyType[4]
    };

    // TODO: Fix consumption!
    // TODO: Add a year selection field
    // Process consumption data to create links from energy types to consumption regions
    ctx.consRegionPart.forEach(cons => {
        if (cons.year === 2020) {
            regions.add("consumption-" + cons.regionName);
            if (cons.filiere_consGWh > 0) {
                links.push({
                    source: cons.energyType,
                    target: "consumption-" + cons.regionName,
                    value: cons.filiere_consGWh
                });
            }
        }
    });

    // Combine and sort unique nodes
    // using slice to exclude 'Marine Energy', 'Geothermal'
    const allNodes = Array.from(new Set([...regions, ...ctx.energyType.slice(0, -2)]));

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

    // Remove any existing SVG first
    d3.select("#sankeyContainer").selectAll("*").remove();

    // Create SVG dynamically
    const svg = d3.select("#sankeyContainer")
        .append("svg")
        .attr("width", ctx.SANKEY_W + ctx.SANKEY_MARGIN.left + ctx.SANKEY_MARGIN.right)
        .attr("height", ctx.SANKEY_H + ctx.SANKEY_MARGIN.top + ctx.SANKEY_MARGIN.bottom);

    // Color scale for nodes
    const color = d3.scaleOrdinal(d3.schemeCategory10);

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
            if (d.source.name.includes("production")){
                return ctx.colorMapping[d.target.name];
            } else if (d.target.name.includes("consumption")) {
                return ctx.colorMapping[d.source.name];
            } else {
                throw new Error(`${d.name} is not a valid region!`);
            }
        })
        .attr("stroke-opacity", 0.5)
        .attr("stroke-width", d => Math.max(1, d.width));

    // Append nodes
    const NODES_WIDTH = 10;
    const node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("rect")
        .data(graph.nodes)
        .enter().append("rect")
        .attr("x", function(d) {
            // if it is not an energy type
            if (ctx.colorMapping[d.name] == undefined) {
                if (d.name.includes("consumption")) {
                    return d.x0;
                } else if (d.name.includes("production")) {
                    return d.x1 - NODES_WIDTH;
                } else {
                    throw new Error(`${d.name} is not a valid region!`);
                }
            } else {
                return d.x0
            }
        })
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", function(d) {
            // if it is not an energy type
            if (ctx.colorMapping[d.name] == undefined) {
                return NODES_WIDTH;
            } else {
                return d.x1 - d.x0
            }
        })
        .attr("fill", function(d) {
            // if it is not an energy type
            if (ctx.colorMapping[d.name] == undefined) {
                return "black";
            } else {
                return ctx.colorMapping[d.name]
            }
        })
        .attr("opacity", 0.6);

    // Add node labels
    svg.append("g")
        .attr("class", "node-labels")
        .selectAll("text")
        .data(graph.nodes)
        .enter().append("text")
        .attr("x", function(d) {
            // if it is not an energy type
            if (ctx.colorMapping[d.name] == undefined) {
                if (d.name.includes("consumption")) {
                    return d.x0 + NODES_WIDTH * 1.5;
                } else if (d.name.includes("production")) {
                    return d.x1 - NODES_WIDTH * 1.5;
                } else {
                    throw new Error(`${d.name} is not a valid region!`);
                }
            } else {
                return (d.x0 + d.x1) / 2
            }
        })
        .attr("y", d => (d.y0 + d.y1) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", function(d) {
            // if it is not an energy type
            if (ctx.colorMapping[d.name] == undefined) {
                if (d.name.includes("consumption")) {
                    return "start";
                } else if (d.name.includes("production")) {
                    return "end";
                } else {
                    throw new Error(`${d.name} is not a valid region!`);
                }
            } else {
                return "middle"
            }
        })
        .text(d => extractRegion(d.name))
        .attr("font-size", "10px")
        .attr("fill", "black");

    // Adds a title on the nodes.
    node.append("title")
        .text(d => `${d.name}\n${d.value} GWh`);
};

function drawScatter() {
    // Clear any existing scatter plot
    d3.select("#scatterPlot").selectAll("*").remove();

    // Set up dimensions and margins
    const width = ctx.SCATTER_W;  // Reduced width
    const height = ctx.SCATTER_H; // Reduced height
    const margin = ctx.SCATTER_MARGIN; // Adjusted margins to fit legend

    // Create SVG
    const svg = d3.select("#scatterPlot")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Prepare data
    const filteredSites = ctx.sitesMap.filter(site =>
        site.long && site.lat && site.sum_max_power_installed > 1
    );

    // X-axis: Energy Type (categorical)
    const energyTypes = [...new Set(filteredSites.map(d => d.energy_type))];
    const xScale = d3.scaleBand()
        .domain(energyTypes)
        .range([0, width])
        .padding(0.1);

    // Y-axis: Installed Power (logarithmic)
    const yScale = d3.scaleLog()
        .domain([1, d3.max(filteredSites, d => d.sum_max_power_installed)]) // Minimum value set to 1 for log scale
        .range([height, 0])
        .nice();

    // Color scale for energy types
    const colorScale = d3.scaleOrdinal()
        .domain(energyTypes)
        .range(d3.schemeCategory10);

    // Add X-axis (Energy Type)
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    // Add Y-axis (Installed Power)
    svg.append("g")
        .call(d3.axisLeft(yScale).ticks(10, "~s")) // Logarithmic ticks
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -40)
        .attr("x", -height / 2)
        .attr("fill", "black")
        .text("Installed Power (GW, Log Scale)");

    // Add scatter points
    svg.selectAll(".site-point")
        .data(filteredSites)
        .enter()
        .append("circle")
        .attr("class", "site-point")
        .attr("cx", d => xScale(d.energy_type) + xScale.bandwidth() / 2 + (Math.random() - 0.5) * xScale.bandwidth() * 0.5)
        .attr("cy", d => yScale(d.sum_max_power_installed))
        .attr("r", 1) // Fixed size
        .attr("fill", d => ctx.colorMapping[d.energy_type])
        .attr("opacity", 0.7)
        .append("title")
        .text(d => `${d.commune} - ${d.energy_type}\nInstalled Power: ${d.sum_max_power_installed.toFixed(2)} GW`);

    // Add legend
    const legend = svg.selectAll(".legend")
        .data(energyTypes)
        .enter()
        .append("g")
        .attr("class", "legend")
        .attr("transform", (d, i) => `translate(${width + 20},${i * 20})`); // Keep the legend aligned to the right

    legend.append("circle")
        .attr("r", 5)
        .attr("fill", d => ctx.colorMapping[d]);

    legend.append("text")
        .attr("x", 10)
        .attr("y", 5)
        .text(d => d)
        .attr("font-size", "10px")
        .attr("text-anchor", "start");
}

function drawRegression() {

};

function drawCapDistribution() {

};

function drawTreeMapSite(data, filters) {
    elementId = "#treeMapSite"
    const filteredData = data.filter(d => {
        const energyMatch = filters.energyType.length === 0 || filters.energyType.includes(d.energy_type);
        const regionMatch =  filters.region.length === 0 || d.region_code == ctx.regionLookup.nameToCode[filters.region];
        return energyMatch && regionMatch;
    });

    const groupedData = d3.group(filteredData, d => d.energy_type);

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
    drawTreeMap(hierarchyData, elementId);
};

function drawTreeMapProd(data, filters) {
    elementId = "#treeMapProd"

    // Energy types to be split
    const energyTypes = [
        { name: "Nuclear", field: "nuclearGWh" },
        { name: "Non-renewable", field: "nonRenewableGWh" },
        { name: "Hydro", field: "hydroGWh" },
        { name: "Wind", field: "windGWh" },
        { name: "Solar", field: "solarGWh" },
        { name: "Bioenergy", field: "bioenergyGWh" }
    ];

    data_2023 = data.filter(d => d.year == 2023);
    // Split the data into rows based on energy types
    const splitData = data_2023.flatMap(entry => 
        energyTypes.map(energyType => ({
            region_code: entry.regionCode,
            region: entry.regionName,
            energy_type: energyType.name,
            prodGWh: entry[energyType.field]
        }))
    );

    console.log("split prod:", splitData);

    const filteredData = splitData.filter(d => {
        const energyMatch = filters.energyType.length === 0 || filters.energyType.includes(d.energy_type);
        const regionMatch =  filters.region.length === 0 || d.region_code == ctx.regionLookup.nameToCode[filters.region];
        return energyMatch && regionMatch;
    });

    const groupedData = d3.group(filteredData, d => d.energy_type);

    // Transform data into hierarchical format for treemap
    const hierarchyData = {
        name: "root",
        children: Array.from(groupedData, ([key, values]) => {
            const totalPower = d3.sum(values, d => d.prodGWh);
            return {
                name: key,
                value: totalPower,
                percentage: totalPower / d3.sum(filteredData, d => d.prodGWh) * 100
            };
        })
    };
    console.log("hier", hierarchyData);

    drawTreeMap(hierarchyData, elementId);
};

function drawLineChart(currentFilters) {
    
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