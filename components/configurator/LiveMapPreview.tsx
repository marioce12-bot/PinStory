import type { ThemeStyle } from "@/lib/plans";
import type { MemoryPoint } from "@/lib/types";

export function LiveMapPreview({
  title,
  message,
  points,
  theme,
}: {
  title: string;
  message: string;
  points: MemoryPoint[];
  theme: ThemeStyle;
}) {
  return (
    <div className="preview-panel">
      <div className={`live-map-preview ${theme}`}>
        <div className="map-path" />
        {points.slice(0, 6).map((point, index) => (
          <span
            className={`custom-marker ${index === 0 ? "marker-active" : ""}`}
            key={point.id}
            style={{
              position: "absolute",
              left: `${22 + ((index * 17) % 58)}%`,
              top: `${25 + ((index * 13) % 48)}%`,
            }}
            title={point.title}
          />
        ))}
        <article className="preview-memory-card popup-animated">
          <p className="popup-date">{points[0]?.date}</p>
          <h2 className="popup-title">{title}</h2>
          <p>{message}</p>
        </article>
      </div>
    </div>
  );
}
