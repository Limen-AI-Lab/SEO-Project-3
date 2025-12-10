import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Props {
  percentage: number;
  size?: number;
  color?: string;
}

const CircularProgress: React.FC<Props> = ({ percentage, size = 60, color = "#4f46e5" }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous

    const radius = size / 2;
    const strokeWidth = 6;
    const normalizedRadius = radius - strokeWidth / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const g = svg.append("g")
      .attr("transform", `translate(${radius},${radius})`);

    // Background circle
    g.append("circle")
      .attr("stroke", "#e2e8f0")
      .attr("stroke-width", strokeWidth)
      .attr("fill", "transparent")
      .attr("r", normalizedRadius);

    // Progress circle
    g.append("circle")
      .attr("stroke", color)
      .attr("stroke-width", strokeWidth)
      .attr("stroke-dasharray", `${circumference} ${circumference}`)
      .attr("stroke-dashoffset", strokeDashoffset)
      .attr("stroke-linecap", "round")
      .attr("fill", "transparent")
      .attr("r", normalizedRadius)
      .attr("transform", "rotate(-90)")
      .style("transition", "stroke-dashoffset 0.5s ease-in-out");

    // Text
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "#334155")
      .attr("font-size", `${size * 0.25}px`)
      .attr("font-weight", "bold")
      .text(`${percentage}%`);

  }, [percentage, size, color]);

  return <svg ref={svgRef} width={size} height={size} />;
};

export default CircularProgress;