/* global dscc, d3 */
const root = d3.select("#root");
const tooltip = d3.select("#tt");

// ——— utils
const fmt = d3.format(",.0f");

// ——— rendu principal
function render(table) {
  root.selectAll("*").remove();
  if (!table || !table.length) {
    root.append("div").style("padding","16px").text("Aucune donnée.");
    return;
  }

  // mappe données (dimension[0] = Zone, metric[0] = Delta)
  const rows = table.map(r => ({
    zone: r.dimension?.[0] ?? "(vide)",
    delta: +r.metric?.[0] ?? 0
  }));

  // ordre conservé tel que fourni par Looker Studio
  let cum = 0;
  const items = rows.map((d) => {
    const y0 = cum;
    const y1 = cum + d.delta;
    cum = y1;
    return { ...d, y0, y1, total:false };
  });

  // barre finale Total
  items.push({ zone: "Total", delta: cum, y0: 0, y1: cum, total:true });

  // dimensions du viewport
  const node = root.node();
  const width  = node.clientWidth || 800;
  const height = node.clientHeight || 400;
  const margin = { top: 20, right: 24, bottom: 64, left: 64 };

  const svg = root.append("svg");
  svg.attr("viewBox", `0 0 ${width} ${height}`);

  const innerW = width  - margin.left - margin.right;
  const innerH = height - margin.top  - margin.bottom;

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .domain(items.map(d => d.zone))
    .range([0, innerW])
    .padding(0.35);

  const yMin = d3.min(items, d => Math.min(d.y0, d.y1));
  const yMax = d3.max(items, d => Math.max(d.y0, d.y1));
  const y = d3.scaleLinear()
    .domain([Math.min(0, yMin), Math.max(0, yMax)]).nice()
    .range([innerH, 0]);

  // axes
  g.append("g").attr("class","x-axis")
    .attr("transform", `translate(0,${y(0)})`)
    .call(d3.axisBottom(x).tickSizeOuter(0));

  g.append("g").attr("class","y-axis")
    .call(d3.axisLeft(y).ticks(6));

  // barres
  g.selectAll(".bar")
    .data(items)
    .enter()
    .append("rect")
    .attr("class", d => d.total ? "bar total" : (d.delta >= 0 ? "bar positive" : "bar negative"))
    .attr("x", d => x(d.zone))
    .attr("width", x.bandwidth())
    .attr("y", d => y(Math.max(d.y0, d.y1)))
    .attr("height", d => Math.abs(y(d.y0) - y(d.y1)))
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .style("left", (event.clientX + 12) + "px")
        .style("top",  (event.clientY + 12) + "px")
        .html(d.total
          ? `<b>Total</b><br/>${fmt(d.delta)}`
          : `<b>${d.zone}</b><br/>Δ ${fmt(d.delta)}`
        );
    })
    .on("mouseleave", () => tooltip.style("opacity", 0));

  // labels sur le haut de chaque barre
  g.selectAll(".label")
    .data(items)
    .enter()
    .append("text")
    .attr("class","label")
    .attr("x", d => x(d.zone) + x.bandwidth()/2)
    .attr("y", d => y(Math.max(d.y0, d.y1)) - 6)
    .attr("text-anchor","middle")
    .text(d => fmt(d.delta));
}

// ——— handler dscc
function drawViz(data) {
  // DEBUG : afficher la structure dans la console une fois puis retirer si besoin
  // console.log(JSON.stringify(data, null, 2));

  const table = data?.tables?.DEFAULT || [];
  render(table);
}

// ——— abonnement aux données Looker Studio
dscc.subscribeToData(drawViz, { transform: dscc.tableTransform });
