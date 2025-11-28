import React from "react";
import { useTranslation } from "react-i18next";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Doughnut, Bar, Pie } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);

// ---------- Grote revenue line chart ----------
export function RevenueLineChart({
  labels,
  revenueValues = [],
  purchaseValues = [],
  salesPromoCostValues = [],
  staffCostValues = [],
  profitValues = [],
}) {
  const { t } = useTranslation("hoteldashboard");
  const datasets = [
    {
      label: t("charts.datasets.revenue"),
      data: revenueValues,
      borderColor: "rgb(59,130,246)",
      backgroundColor: "rgba(59,130,246,0.25)",
      tension: 0.35,
      pointRadius: 2,
      fill: false,
    },
  ];
  if (purchaseValues.length) {
    datasets.push({
      label: t("charts.datasets.purchase"),
      data: purchaseValues,
      borderColor: "rgb(250,204,21)",
      backgroundColor: "rgba(250,204,21,0.25)",
      tension: 0.35,
      pointRadius: 2,
      fill: false,
    });
  }
  if (salesPromoCostValues.length) {
    datasets.push({
      label: t("charts.datasets.salesPromoCost"),
      data: salesPromoCostValues,
      borderColor: "rgb(168,85,247)",
      backgroundColor: "rgba(168,85,247,0.25)",
      tension: 0.35,
      pointRadius: 2,
      fill: false,
    });
  }
  if (staffCostValues.length) {
    datasets.push({
      label: t("charts.datasets.staffCost"),
      data: staffCostValues,
      borderColor: "rgb(239,68,68)",
      backgroundColor: "rgba(239,68,68,0.25)",
      tension: 0.35,
      pointRadius: 2,
      fill: false,
    });
  }
  if (profitValues.length) {
    datasets.push({
      label: t("charts.datasets.profit"),
      data: profitValues,
      borderColor: "rgb(34,197,94)",
      backgroundColor: "rgba(34,197,94,0.25)",
      tension: 0.35,
      pointRadius: 2,
      fill: false,
    });
  }
  const data = { labels, datasets };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { display: true, position: "top" }, tooltip: { mode: "index", intersect: false } },
    scales: {
      x: { grid: { display: false } },
      y: {
        ticks: { callback: (v) => `€${v.toLocaleString()}` },
        grid: { color: "rgba(0,0,0,0.06)" },
      },
    },
  };
  return (
    <div className="w-full h-72 md:h-80">
      <Line data={data} options={options} />
    </div>
  );
}

// ---------- Kleine sparkline (zonder assen) ----------
export function SparkLineChart({ labels, values, label }) {
  const { t } = useTranslation("hoteldashboard");
  const resolvedLabel = label ?? t("charts.datasets.trend");
  const data = {
    labels,
    datasets: [
      {
        label: resolvedLabel,
        data: values,
        borderColor: "hsl(var(--chart-1))",
        backgroundColor: "hsla(var(--chart-1)/0.2)",
        tension: 0.35,
        pointRadius: 0,
        fill: true,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false } },
    scales: {
      x: { display: false },
      y: { display: false },
    },
  };
  return (
    <div className="w-full h-32">
      <Line data={data} options={options} />
    </div>
  );
}

// ---------- Donut (sales mix) ----------
export function SalesMixDonut({ labels, values }) {
  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: [
          "#8B4513",
          "#3B82F6",
          "#6B7280",
        ],
        borderWidth: 0,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "65%",
    plugins: {
      legend: { display: true, position: "bottom" },
      tooltip: { callbacks: { label: (ctx) => `${ctx.label}: €${ctx.parsed.toLocaleString()}` } },
    },
  };
  return (
    <div className="w-full h-52">
      <Doughnut data={data} options={options} />
    </div>
  );
}

// ---------- Pie chart for revenue by weekday ----------
export function WeekdayRevenuePie({ labels, values }) {
  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: [
          "#3B82F6",
          "#10B981",
          "#F59E0B",
          "#EF4444",
          "#8B5CF6",
          "#EC4899",
          "#6B7280",
        ],
        borderWidth: 0,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "bottom" },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: €${ctx.parsed.toLocaleString()}`,
        },
      },
    },
  };
  return (
    <div className="w-full h-52">
      <Pie data={data} options={options} />
    </div>
  );
}

// ---------- Horizontale staafdiagram voor rankings ----------
export function HorizontalBarChart({ labels = [], values = [], color = "rgb(59,130,246)" }) {
  const formattedLabels = labels.map((l) => {
    if (l.length <= 15) return l;
    const words = l.split(" ");
    const lines = [];
    let current = "";
    words.forEach((w) => {
      if ((current + w).length > 15) {
        lines.push(current.trim());
        current = "";
      }
      current += w + " ";
    });
    if (current.trim()) lines.push(current.trim());
    return lines;
  });

  const data = {
    labels: formattedLabels,
    datasets: [
      {
        data: values,
        backgroundColor: color,
        borderWidth: 0,
      },
    ],
  };
  const options = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `€${ctx.parsed.x.toLocaleString()}`,
          title: (items) =>
            Array.isArray(items[0].label)
              ? items[0].label.join(" ")
              : items[0].label,
        },
      },
    },
    scales: {
      x: {
        ticks: { callback: (v) => `€${v.toLocaleString()}` },
        grid: { display: false },
      },
      y: {
        grid: { display: false },
        ticks: { autoSkip: false },
      },
    },
  };
  return (
    <div className="w-full h-48">
      <Bar data={data} options={options} />
    </div>
  );
}

export default RevenueLineChart;
