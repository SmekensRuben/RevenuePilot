import React from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";

// Kleuren per type
const COLORS = {
  Star: "#22c55e",
  Plowhorse: "#3b82f6",
  Puzzle: "#facc15",
  Dog: "#ef4444"
};

export default function MenuEngineeringMatrix({ results }) {
  if (!results || results.length === 0) {
    return <div className="text-gray-500">Geen data om te tonen.</div>;
  }

  // Data klaarzetten
  const data = results.map((r) => ({
    x: r.sold,
    y: r.marge,
    name: r.product,
    type: r.classification,
  }));

  // Limieten en padding bepalen
  const soldValues = data.map(d => d.x);
  const margeValues = data.map(d => d.y);

  const minSold = Math.min(...soldValues);
  const maxSold = Math.max(...soldValues);
  const avgSold = soldValues.reduce((a, b) => a + b, 0) / soldValues.length || 0;

  const minMarge = Math.min(...margeValues);
  const maxMarge = Math.max(...margeValues);
  const avgMarge = margeValues.reduce((a, b) => a + b, 0) / margeValues.length || 0;

  // Padding zodat punten nooit tegen de rand plakken
  const soldPadding = (maxSold - minSold) * 0.1 || 1;
  const margePadding = (maxMarge - minMarge) * 0.1 || 1;

  return (
    <div className="w-full h-[370px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart
          margin={{ top: 20, right: 40, left: 40, bottom: 50 }}
        >
          <CartesianGrid />
          <XAxis
            type="number"
            dataKey="x"
            name="Populariteit"
            label={{
              value: "Populariteit (Aantal verkocht)",
              position: "bottom",
              offset: 0,
              fontSize: 14
            }}
            domain={[
              Math.floor(minSold - soldPadding),
              Math.ceil(maxSold + soldPadding)
            ]}
            tickCount={6}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Marge per stuk (€)"
            label={{
              value: "Marge per stuk (€)",
              angle: -90,
              position: "insideLeft",
              fontSize: 14,
              dx: -20
            }}
            domain={[
              minMarge - margePadding,
              maxMarge + margePadding
            ]}
            tickCount={6}
            tickFormatter={v =>
              "€" + Number(v).toLocaleString("nl-BE", { maximumFractionDigits: 2 })
            }
          />

          {/* Gemiddelde lijnen voor kwadranten */}
          <ReferenceLine x={avgSold} stroke="#aaa" strokeDasharray="4 2" />
          <ReferenceLine y={avgMarge} stroke="#aaa" strokeDasharray="4 2" />

          {/* Tooltips */}
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white border rounded px-3 py-2 shadow text-xs">
                  <div className="font-bold">{d.name}</div>
                  <div className="mb-1">{d.type}</div>
                  <div>
                    <span className="text-gray-600">Aantal verkocht: </span>
                    <b>{d.x}</b>
                  </div>
                  <div>
                    <span className="text-gray-600">Marge per stuk: </span>
                    <b>€{d.y.toLocaleString("nl-BE", { maximumFractionDigits: 2 })}</b>
                  </div>
                </div>
              );
            }}
          />

          {/* Één scatter per type, voor kleur & legenda */}
          {["Star", "Plowhorse", "Puzzle", "Dog"].map(type => (
            <Scatter
              key={type}
              name={type}
              data={data.filter(d => d.type === type)}
              fill={COLORS[type]}
              shape="circle"
            />
          ))}
          <Legend
            verticalAlign="top"
            formatter={value => (
              <span style={{ color: COLORS[value], fontWeight: 600 }}>{value}</span>
            )}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
