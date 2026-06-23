import type { ThemeStyle } from "@/lib/plans";
import type { MemoryPoint } from "@/lib/types";

export function LiveMapPreview({
  title,
  message,
  points,
  theme,
  onPickLocation,
}: {
  title: string;
  message: string;
  points: MemoryPoint[];
  theme: ThemeStyle;
  onPickLocation?: (longitude: number, latitude: number, label: string) => void;
}) {
  function handlePreviewClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!onPickLocation) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;

    // Preview-only coordinate approximation centered around Paris until real Mapbox editing is connected.
    const longitude = 2.3522 + (x - 0.5) * 0.28;
    const latitude = 48.8566 - (y - 0.5) * 0.18;
    onPickLocation(Number(longitude.toFixed(5)), Number(latitude.toFixed(5)), "Point sélectionné sur la carte");
  }

  return (
    <div className="preview-panel">
      <div className={`live-map-preview ${theme}`} onClick={handlePreviewClick} role={onPickLocation ? "button" : undefined} tabIndex={onPickLocation ? 0 : undefined}>
        <div className="map-path" />
        <div className="preview-media-collage" aria-hidden="true">
          {points.filter((point) => point.media_url).slice(0, 4).map((point) => (
            <div className="preview-media-tile" key={point.id}>
              {point.media_type === "video" ? (
                <video src={point.media_url} muted playsInline />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={point.media_url} alt="" />
              )}
            </div>
          ))}
        </div>
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
          <p className="popup-date" style={{ marginTop: "0.75rem" }}>{points[0]?.place_name}</p>
        </article>
      </div>
    </div>
  );
}
