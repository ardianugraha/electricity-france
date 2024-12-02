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
    // TODO 
    // call draw functions here

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

    }).catch(function (error) { console.log(error) });
};

function drawMap() {
    //TODO
    // draw France map with its regions

};

function drawSankey() {

};

function drawRegression() {

};

function drawCapDistribution() {

};