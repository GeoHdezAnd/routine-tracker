import { useState } from "react";
import type { ReactNode } from "react";

export function ExerciseThumbnail({
  imageUrl,
  size = "size-8",
  fallback = null,
}: {
  imageUrl?: string | null;
  size?: string;
  fallback?: ReactNode;
}) {
  const [hasError, setHasError] = useState(false);

  if (imageUrl && !hasError) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={`${size} shrink-0 rounded-full bg-surface-muted object-cover`}
        onError={() => setHasError(true)}
      />
    );
  }

  return <>{fallback}</>;
}
