import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export default function PriceHistoryChart({ history = [] }) {
  const { t } = useTranslation("articles");
  const { data, options } = useMemo(() => {
    if (!history.length) return { data: null, options: null };
    const sorted = [...history].sort((a, b) => a.date - b.date);
    return {
      data: {
        labels: sorted.map(h => new Date(h.date).toLocaleDateString("nl-BE")),
        datasets: [
          {
            label: t("price"),
            data: sorted.map(h => h.price),
            borderColor: "hsl(var(--chart-1))",
            backgroundColor: "hsla(var(--chart-1)/0.3)",
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            ticks: {
              callback: (v) => `€${v}`,
            },
          },
        },
      },
    };
  }, [history]);

  if (!data) {
    return <div className="text-gray-500 text-sm">{t("noPriceHistory")}</div>;
  }

  return (
    <div className="w-full h-48">
      <Line data={data} options={options} />
    </div>
  );
}
