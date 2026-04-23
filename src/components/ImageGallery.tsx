import type { ApiRestaurantPhoto } from "../types";

const defaultFallback =
  "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1400&q=80";

interface ImageGalleryProps {
  title: string;
  photos: ApiRestaurantPhoto[];
  altBase: string;
  compact?: boolean;
}

function ImageGallery({ title, photos, altBase, compact = false }: ImageGalleryProps) {
  const galleryPhotos =
    photos.length > 0
      ? photos
      : [
          {
            url: defaultFallback,
            source: "fallback"
          }
        ];

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
        {galleryPhotos.map((photo, index) => (
          <img
            key={`${photo.url}-${index}`}
            src={photo.url}
            alt={`${altBase} photo ${index + 1}`}
            loading="lazy"
            decoding="async"
            className={`w-full rounded-lg object-cover ${compact ? "h-28" : "h-44"}`}
          />
        ))}
      </div>
    </div>
  );
}

export default ImageGallery;
