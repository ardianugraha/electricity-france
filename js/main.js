const ctx = {
    MAP_W: 1024,
    MAP_H: 1024,
    YEAR: "2020",
};

function createViz() {
    console.log("Using D3 v" + d3.version);
    svgEl = d3.select("#mapContainer").append("svg")
                              .attr("width", ctx.MAP_W)
                              .attr("height", ctx.MAP_H);
    loadData(svgEl);
};

function loadData(svgEl) {
    const promise_files = [
        d3.json("data/0601/cntbn.geojson"),
        d3.json("data/0601/cntrg.geojson"),
        d3.json("data/0601/gra.geojson"),
        d3.json("data/0601/nutsbn.geojson"),
        d3.json("data/0601/nutsrg.geojson"),
        d3.csv("data/0601/pop_density_nuts3.csv")
    ];

    Promise.all(promise_files).then(function (data) {
        
        const cntbn = data[0];
        const cntrg = data[1];
        const graticule = data[2];
        const nutsbn = data[3]
        const nutsrg = data[4];
        const pop_density = data[5];

        // console.log(nutsrg);
        // console.log(pop_density);
        // console.log(nutsbn);

        // Iterate over each feature in nutsrg.features
        nutsrg.features.forEach(feature => {
            const nuts3_id = feature.properties.id;

            const matchingRows = pop_density.filter(item => item.geo === nuts3_id);
            const densityRow = matchingRows.find(item => item.TIME_PERIOD === ctx.YEAR);

            if (densityRow) {
                feature.properties.density = +densityRow.OBS_VALUE; // + converts string to number
            } else {
                feature.properties.density = null; // Or assign a default value
            }
        });

        // console.log(nutsrg);

        ctx.proj = d3.geoIdentity()
                    .reflectY(true)
                    .fitSize([ctx.MAP_W, ctx.MAP_H], graticule);
        // graticule is the data structure parsed from gra.geojson

        let geoPathGen = d3.geoPath()
                            .projection(ctx.proj);

        let densityExtent = d3.extent(nutsrg.features, (d) => (d.properties.density));
        const densityLogScale = d3.scaleLog().domain(densityExtent);
        const densityColorScale = d3.scaleSequential((d) => d3.interpolateViridis(densityLogScale(d)));
        
        svgEl.append("g").attr("id", "country")
            .selectAll("path")
            .data(cntrg.features)
            .enter()
            .append("path")
            .attr("d", geoPathGen)
            .attr("class", "countryArea")
            .attr("stroke", "black")
            .style("fill", "lightgray");

        svgEl.select("g#country")
            .selectAll("path")
            .data(cntbn.features)
            .enter()
            .append("path")
            .attr("d", geoPathGen)
            .attr("class", "countryBorder")
            .attr("stroke", "black"); 

        svgEl.append("g").attr("id", "nuts")
            .selectAll("path")
            .data(nutsrg.features)
            .enter()
            .append("path")
            .attr("d", geoPathGen)
            .attr("class", "nutsArea")
            .attr("stroke", "gray")
            .style("fill", d => d.properties.density ? densityColorScale(d.properties.density) : "lightgray");

        svgEl.select("g#nuts")
            .selectAll("path")
            .data(nutsbn.features)
            .enter()
            .append("path")
            .attr("d", geoPathGen)
            .attr("class", "nutsBorder")
            .attr("stroke", "gray");

    }).catch(function (error) { console.log(error) });
};

// NUTS data as JSON from https://github.com/eurostat/Nuts2json (translated from topojson to geojson)
// density data from https://data.europa.eu/data/datasets/gngfvpqmfu5n6akvxqkpw?locale=en
