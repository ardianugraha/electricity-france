// TODO
// define functions here
function extractRegion(str) {
    if (str.includes("-") & (str.includes("production") || str.includes("consumption"))) {
        return str.substring(str.indexOf("-") + 1);
    }
    return str;
}

function normalizeRegion(str) {
    return str.replaceAll(" ", "_").replace("'", "");
}

const createFilter = (key, param, container) => {
    const filterButton = document.createElement("button");
    filterButton.className = "filter-button";
    filterButton.innerText = param;
    filterButton.setAttribute("data-state", "inactive");
    filterButton.addEventListener("click", (e) =>
        handleButtonClick(e, key, param, container)
    );

    container.append(filterButton);
};

const handleButtonClick = (e, key, param, container) => {
    const button = e.target;
    const buttonState = button.getAttribute("data-state");

    if (buttonState == "inactive") {
        button.classList.add("is-active");
        button.setAttribute("data-state", "active");
        ctx.currentFilters[key].push(param);
    } else {
        button.classList.remove("is-active");
        button.setAttribute("data-state", "inactive");
        ctx.currentFilters[key] = ctx.currentFilters[key].filter((item) => item !== param);
    }

    updateFilter(ctx.currentFilters);
};

function populateRegionDropdown(data) {
    // Extract unique regions
    const regions = [...new Set(data.features.map(d => d.properties.region_name))].sort();

    // Populate the dropdown
    const dropdown = d3.select("#region-select");
    dropdown.append("option").attr("value", "").text("Select region"); // Default option

    regions.forEach(region => {
        dropdown.append("option")
            .attr("value", region)
            .text(region);
    });

    // Initialize Select2
    $('#region-select').select2({
        placeholder: "Select region",
        allowClear: true
    });

    // Handle change event
    $('#region-select').on("change", function () {
        const selectedRegion = $(this).val();
        ctx.currentFilters.region = selectedRegion;
        updateFilter(ctx.currentFilters);
    });
};

function updateFilter(currentFilters) {
    const allEnergyTypes = Object.keys(ctx.sitesMap.reduce((types, site) => {
        types[site.energy_type] = true;
        return types;
    }, {}));

    const filteredSites = ctx.sitesMap.filter(d => 
        d.sum_max_power_installed >= ctx.currentFilters.minPower &&
        d.sum_max_power_installed <= ctx.currentFilters.maxPower &&
        (ctx.currentFilters.energyType.length === 0 || ctx.currentFilters.energyType.includes(d.energy_type))
    );

    // allEnergyTypes.forEach(type => {
    //     const normalizedType = type.replace(/\s+/g, '-'); // Normalize type to match the class
    //     const shouldShow =
    //         currentFilters.energyType.length === 0 || // No filter applied
    //         currentFilters.energyType.includes(type);

    //     // update map
    //     d3.selectAll(`circle.${normalizedType}`)
    //         .style("opacity", shouldShow ? 0.7 : 0)
    //         .style("pointer-events", shouldShow ? "auto" : "none");
    // });
    plotSites();
    // update treemap
    drawTreeMapSite(ctx.sitesMap, currentFilters);
    drawTreeMapProd(ctx.prodRegion, currentFilters);
    // drawLineChart(currentFilters);

    // Because the minimum value for logarithmic scale is 1
    var scatterMinSitesPower =  (ctx.currentFilters.minPower < 1) ? 1 : ctx.currentFilters.minPower;

    if (ctx.currentFilters.region == "") {
        // Sankey Plot
        d3.select("g.links")
            .selectAll("path")
            .transition()
            .duration(1000)
            .attr("stroke", function (d) {
                if (d.source.name.includes("production")){
                    return ctx.colorMapping[d.target.name];
                } else if (d.target.name.includes("consumption")) {
                    return ctx.colorMapping[d.source.name];
                } else {
                    throw new Error(`${d.name} is not a valid region!`);
                }
            });
        
        // Scatter Plot
        d3.selectAll(`circle.site-point`)
            .filter(function(d) {
                // Check if the 'cy' value is within a certain range
                return  d3.select(this).attr("cy") <= ctx.yScaleScatter(scatterMinSitesPower) &&
                        d3.select(this).attr("cy") >= ctx.yScaleScatter(ctx.currentFilters.maxPower);
            })
            .transition()
            .duration(1000)
            .attr("opacity", 0.6)
            .attr("r", 1)
    } else {
        // Sankey Plot
        d3.selectAll(`path.${normalizeRegion(ctx.currentFilters.region)}`)
            .transition()
            .duration(1000)
            .attr("stroke", function (d) {
                if (d.source.name.includes("production")){
                    return ctx.colorMapping[d.target.name];
                } else if (d.target.name.includes("consumption")) {
                    return ctx.colorMapping[d.source.name];
                } else {
                    throw new Error(`${d.name} is not a valid region!`);
                }
            });

        // Change stroke of all other paths
        d3.selectAll(`path:not(.${normalizeRegion(ctx.currentFilters.region)})`)
            .transition()
            .duration(1000)
            .attr("stroke", "gray");

        // Scatter Plot
        d3.selectAll(`circle.site-point.${normalizeRegion(ctx.currentFilters.region)}`)
            .filter(function(d) {
                // Check if the 'cy' value is within a certain range
                return  d3.select(this).attr("cy") <= ctx.yScaleScatter(scatterMinSitesPower) &&
                        d3.select(this).attr("cy") >= ctx.yScaleScatter(ctx.currentFilters.maxPower);
            })
            .transition()
            .duration(1000)
            .attr("opacity", 0.6)
            .attr("r", 1)

        d3.selectAll(`circle.site-point:not(.${normalizeRegion(ctx.currentFilters.region)})`)
            .transition()
            .duration(1000)
            .attr("opacity", 0)
            .attr("r", 0)
    }

    // fade out points that are not in range
    d3.selectAll(`circle.site-point`)
        .filter(function(d) {
            // Check if the 'cy' value is within a certain range
            return  !(d3.select(this).attr("cy") <= ctx.yScaleScatter(scatterMinSitesPower) &&
                    d3.select(this).attr("cy") >= ctx.yScaleScatter(ctx.currentFilters.maxPower));
        })
        .transition()
        .duration(1000)
        .attr("opacity", 0)
        .attr("r", 0)

    drawScatterStatistics(ctx.currentFilters.region)
};

function groupSitesByCommune(sites) {
    return sites.reduce((acc, site) => {
        if (!acc[site.commune]) {
            acc[site.commune] = [];
        }
        acc[site.commune].push(site);
        return acc;
    }, {});
};

function showCommuneTooltip(commune, siteDetails, x, y) {
    const tooltip = d3.select("#tooltip");
    tooltip.style("left", `${x + 10}px`)
        .style("top", `${y + 10}px`)
        .html(`
            <strong>${commune}</strong>
            <div style="margin-top: 2px;">${siteDetails}</div>
        `)
        .style("visibility", "visible");
};

function showRegionTooltip(region, x, y) {
    const tooltip = d3.select("#tooltip");
    tooltip.style("left", `${x + 10}px`)
        .style("top", `${y + 10}px`)
        .html(`
            <strong>${ctx.regionLookup.codeToName[region]}</strong>
        `)
        .style("visibility", "visible");
};
function hideTooltip() {
    const tooltip = d3.selectAll("#tooltip");
    tooltip.style("visibility", "hidden");
};

const findStr = (arr, str) => arr.some(e => e.toLowerCase().search(str.toLowerCase()) !== -1)

function capitalizeFirstLetter(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

function handleRegionClick(regionCode) {
    const regionName = ctx.regionLookup.codeToName[regionCode];
    ctx.currentFilters.region = regionName;

    // Update dropdown to match the clicked region
    $('#region-select').val(regionName).trigger('change');

    // Update treemap and other visuals
    updateFilter(ctx.currentFilters);
}

function drawTreeMap(hierarchyData, elementId) {
    d3.select(elementId).selectAll("*").remove();

    // Specify dimensions
    const width = 300;
    const height = 280;
  
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
    const svg = d3.select(elementId)
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
    
    if (elementId == "#treeMapSite") {
        unit = "GW" // unit of generator
    } else {
        unit = "GWh" // unit of production
    }
    // Add tooltips
    leaf.append("title")
        .text(d => `${d.data.name}\n${d.data.value.toFixed(2)} ${unit}`);
  
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

function getSummaryStatistics(data) {
    return d3.rollup(data, function (d) {
        let q1 = d3.quantile(d.map(function (p) { return p.sum_max_power_installed; }).sort(d3.ascending), .25);
        let median = d3.quantile(d.map(function (p) { return p.sum_max_power_installed; }).sort(d3.ascending), .5);
        let q3 = d3.quantile(d.map(function (p) { return p.sum_max_power_installed; }).sort(d3.ascending), .75);
        let iqr = q3 - q1;
        let min = d3.min(data, (d) => (d.sum_max_power_installed));
        let max = d3.max(data, (d) => (d.sum_max_power_installed));
        return ({ q1: q1, median: median, q3: q3, iqr: iqr, min: min, max: max })
    });
};

function logHistogram(values, numBins = 20) {
    // Ensure all values are positive
    const positiveValues = values.filter(v => v > 0);
    
    if (positiveValues.length === 0) return [];

    // Calculate log range
    const logMin = Math.log(Math.min(...positiveValues));
    const logMax = Math.log(Math.max(...positiveValues));
    
    // Create log-spaced thresholds
    const logThresholds = Array.from(
        {length: numBins + 1}, 
        (_, i) => Math.exp(logMin + (logMax - logMin) * i / numBins)
    );

    // Create bins manually
    const bins = [];
    for (let i = 0; i < logThresholds.length - 1; i++) {
        const bin = positiveValues.filter(
            v => v >= logThresholds[i] && v < logThresholds[i+1]
        );
        
        bins.push({
            x0: logThresholds[i],
            x1: logThresholds[i+1],
            length: bin.length
        });
    }

    return bins;
}

function controlFromInput(fromSlider, fromInput, toInput, controlSlider) {
    const [from, to] = getParsed(fromInput, toInput);
    fillSlider(fromInput, toInput, '#C6C6C6', '#1a1d21', controlSlider);
    if (from > to) {
        fromSlider.value = to;
        fromInput.value = to;
    } else {
        fromSlider.value = from;
    }
    ctx.currentFilters.minPower = from;
    console.log(ctx.currentFilters);
    updateFilter(ctx.currentFilters);

}
    
function controlToInput(toSlider, fromInput, toInput, controlSlider) {
    const [from, to] = getParsed(fromInput, toInput);
    fillSlider(fromInput, toInput, '#C6C6C6', '#1a1d21', controlSlider);
    setToggleAccessible(toInput);
    if (from <= to) {
        toSlider.value = to;
        toInput.value = to;
    } else {
        toInput.value = from;
    }
    ctx.currentFilters.maxPower = to;
    console.log(ctx.currentFilters);
    updateFilter(ctx.currentFilters);

}

function controlFromSlider(fromSlider, toSlider, fromInput) {
    const [from, to] = getParsed(fromSlider, toSlider);
    fillSlider(fromSlider, toSlider, '#C6C6C6', '#1a1d21', toSlider);
    if (from > to) {
        fromSlider.value = to;
        fromInput.value = to;
    } else {
        fromInput.value = from;
    }
    ctx.currentFilters.minPower = from;
    console.log(ctx.currentFilters);
    updateFilter(ctx.currentFilters);

}

function controlToSlider(fromSlider, toSlider, toInput) {
    const [from, to] = getParsed(fromSlider, toSlider);
    fillSlider(fromSlider, toSlider, '#C6C6C6', '#1a1d21', toSlider);
    setToggleAccessible(toSlider);
    if (from <= to) {
        toSlider.value = to;
        toInput.value = to;
    } else {
        toInput.value = from;
        toSlider.value = from;
    }
    ctx.currentFilters.maxPower = to;
    console.log(ctx.currentFilters);
    updateFilter(ctx.currentFilters);

}

function getParsed(currentFrom, currentTo) {
    const from = parseInt(currentFrom.value, 10);
    const to = parseInt(currentTo.value, 10);
    return [from, to];
}

function fillSlider(from, to, sliderColor, rangeColor, controlSlider) {
    const rangeDistance = to.max-to.min;
    const fromPosition = from.value - to.min;
    const toPosition = to.value - to.min;
    controlSlider.style.background = `linear-gradient(
        to right,
        ${sliderColor} 0%,
        ${sliderColor} ${(fromPosition)/(rangeDistance)*100}%,
        ${rangeColor} ${((fromPosition)/(rangeDistance))*100}%,
        ${rangeColor} ${(toPosition)/(rangeDistance)*100}%, 
        ${sliderColor} ${(toPosition)/(rangeDistance)*100}%, 
        ${sliderColor} 100%)`;
}

function setToggleAccessible(currentTarget) {
    const toSlider = document.querySelector('#toSlider');
    if (Number(currentTarget.value) <= 0 ) {
        toSlider.style.zIndex = 2;
    } else {
        toSlider.style.zIndex = 0;
    }
}

function initializeRangeControls() {
    const [minCapacity, maxCapacity ] = d3.extent(ctx.sitesMap, d => d.sum_max_power_installed);

    // Select the sliders and inputs
    const fromSlider = document.querySelector('#fromSlider');
    const toSlider = document.querySelector('#toSlider');
    const fromInput = document.querySelector('#fromInput');
    const toInput = document.querySelector('#toInput');

    // Update the min and max attributes
    fromSlider.min = fromInput.min = minCapacity;
    fromSlider.max = fromInput.max = maxCapacity;
    toSlider.min = toInput.min = minCapacity;
    toSlider.max = toInput.max = maxCapacity;

    // Set the initial values
    fromSlider.value = fromInput.value = minCapacity;
    toSlider.value = toInput.value = maxCapacity;

    // Sync ctx.currentFilters
    ctx.currentFilters.minPower = minCapacity;
    ctx.currentFilters.maxPower = maxCapacity;

    // Initialize the slider fill and toggle accessibility
    fillSlider(fromSlider, toSlider, '#C6C6C6', '#1a1d21', toSlider);
    setToggleAccessible(toSlider);

    // Add event listeners for interactivity
    fromSlider.oninput = () => controlFromSlider(fromSlider, toSlider, fromInput);
    toSlider.oninput = () => controlToSlider(fromSlider, toSlider, toInput);
    fromInput.oninput = () => controlFromInput(fromSlider, fromInput, toInput, toSlider);
    toInput.oninput = () => controlToInput(toSlider, fromInput, toInput, toSlider);
}

function drawScatterStatistics(selectedRegion) {

    svg = d3.select("div#scatterPlot").select("svg").select("g")

    d3.selectAll(".selectedRegionStatistics")
        .transition()
        .duration(500)
        .style("opacity", 0)
        .remove();

    if (selectedRegion != "") {
        // Prepare data
        const filteredSites = ctx.sitesMap.filter(site =>
            site.sum_max_power_installed >= ctx.currentFilters.minPower &&
            site.sum_max_power_installed <= ctx.currentFilters.maxPower &&
            site.long && site.lat && site.sum_max_power_installed > 1 && site.region==selectedRegion
        );

        // X-axis: Energy Type (categorical)
        const energyTypes = [...new Set(filteredSites.map(d => d.energy_type))];

        var sumstat = Array.from(
            d3.group(filteredSites, d => d.energy_type),
            ([key, values]) => {
                // Filter out zero or negative values
                const validValues = values
                    .map(d => d.sum_max_power_installed);
                const histogramResult = logHistogram(validValues);
                return {
                    key: key,
                    value: histogramResult
                };
            }
        );
    
        // What is the biggest number of value in a bin? We need it cause this value will have a width of 100% of the bandwidth.
        var violinxScales = []
        for (i in sumstat){
            allBins = sumstat[i].value
            lengths = allBins.map(function(a){return a.length;})
            max = d3.max(lengths)
            violinxScales.push(
                d3.scaleLinear()
                .range([0, ctx.xScaleScatter.bandwidth()])
                .domain([-max,max])
            );
        }
    
        // Draw box with transitions
        for (let i = 0; i < energyTypes.length - 1; i++) {
            let data = filteredSites.filter(function (d) { return d.energy_type == energyTypes[i] });
            statistics = getSummaryStatistics(data);

            // Median line with transition
            svg.append('line')
                .attr("class", "selectedRegionStatistics")
                .style("stroke", d => ctx.colorMapping[energyTypes[i]])
                .style("stroke-width", ctx.SCATTER_STROKE_WIDTH)
                .attr("x1", ctx.xScaleScatter(energyTypes[i]))
                .attr("y1", ctx.yScaleScatter(statistics.median))
                .attr("x2", ctx.xScaleScatter(energyTypes[i]) + ctx.xScaleScatter.bandwidth())
                .attr("y2", ctx.yScaleScatter(statistics.median))
                .style("opacity", 0)  // Start with opacity 0 for fade-in
                .transition()  // Apply transition
                .duration(1000)  // Duration of 1 second
                .style("opacity", 0.8);  // Fade-in effect

            // IQR box with transition
            svg.append('rect')
                .attr("class", "selectedRegionStatistics")
                .style("stroke", d => ctx.colorMapping[energyTypes[i]])
                .style("stroke-width", ctx.SCATTER_STROKE_WIDTH)
                .style("fill", "transparent")
                .attr("x", ctx.xScaleScatter(energyTypes[i]))
                .attr("y", ctx.yScaleScatter(statistics.q3))
                .attr("width", ctx.xScaleScatter.bandwidth())
                .attr("height", Math.abs(ctx.yScaleScatter(statistics.q1) - ctx.yScaleScatter(statistics.q3)))
                .style("opacity", 0)  // Start with opacity 0 for fade-in
                .transition()  // Apply transition
                .duration(1000)  // Duration of 1 second
                .style("opacity", 0.8);  // Fade-in effect

            // Min and Max lines with transition
            svg.append('line')
                .attr("class", "selectedRegionStatistics")
                .style("stroke", "#848484")
                .style("stroke", d => ctx.colorMapping[energyTypes[i]])
                .style("stroke-width", ctx.SCATTER_STROKE_WIDTH)
                .attr("x1", ctx.xScaleScatter(energyTypes[i]) + 5)
                .attr("y1", ctx.yScaleScatter(statistics.min))
                .attr("x2", ctx.xScaleScatter(energyTypes[i]) + ctx.xScaleScatter.bandwidth() - 5)
                .attr("y2", ctx.yScaleScatter(statistics.min))
                .style("opacity", 0)  // Start with opacity 0 for fade-in
                .transition()  // Apply transition
                .duration(1000)  // Duration of 1 second
                .style("opacity", 0.8);

            svg.append('line')
                .attr("class", "selectedRegionStatistics")
                .style("stroke", d => ctx.colorMapping[energyTypes[i]])
                .style("stroke-width", ctx.SCATTER_STROKE_WIDTH)
                .attr("x1", ctx.xScaleScatter(energyTypes[i]) + 5)
                .attr("y1", ctx.yScaleScatter(statistics.max))
                .attr("x2", ctx.xScaleScatter(energyTypes[i]) + ctx.xScaleScatter.bandwidth() - 5)
                .attr("y2", ctx.yScaleScatter(statistics.max))
                .style("opacity", 0)  // Start with opacity 0 for fade-in
                .transition()  // Apply transition
                .duration(1000)  // Duration of 1 second
                .style("opacity", 0.8);

            svg.append('line')
                .attr("class", "selectedRegionStatistics")
                .style("stroke", d => ctx.colorMapping[energyTypes[i]])
                .style("stroke-width", ctx.SCATTER_STROKE_WIDTH)
                .attr("x1", ctx.xScaleScatter(energyTypes[i]) + ctx.xScaleScatter.bandwidth() / 2)
                .attr("y1", ctx.yScaleScatter(statistics.min))
                .attr("x2", ctx.xScaleScatter(energyTypes[i]) + ctx.xScaleScatter.bandwidth() / 2)
                .attr("y2", ctx.yScaleScatter(statistics.max))
                .style("opacity", 0)  // Start with opacity 0 for fade-in
                .transition()  // Apply transition
                .duration(1000)  // Duration of 1 second
                .style("opacity", 0.8);
        }

        // Violin plot paths with transitions
        svg.selectAll("myViolin")
            .data(sumstat)
            .enter()
            .append("g")
            .attr("class", "selectedRegionStatistics")
            .attr("transform", d => `translate(${ctx.xScaleScatter(d.key)},0)`)
            .append("path")
            .datum(d => d.value)
            .style("stroke", "none")
            .style("fill", d => ctx.colorMapping[sumstat.find(s => s.value === d).key])
            .style("opacity", 0)  // Start with opacity 0 for fade-in
            .transition()  // Apply transition
            .duration(1000)  // Duration of 1 second
            .style("opacity", 0.2)  // Fade-in effect
            .attr("d", (d, i, nodes) => {
                const energyType = sumstat[i].key;
                const xScale = violinxScales[energyTypes.indexOf(energyType)];
                return d3.area()
                    .x0(d => xScale(-d.length))
                    .x1(d => xScale(d.length))
                    .y(d => ctx.yScaleScatter(d.x0))
                    .curve(d3.curveCatmullRom)(d);
            });
    }
    
}
