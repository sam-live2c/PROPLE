import { useState, useEffect, useRef } from "react";

interface ImageCarouselProps {
  images: string[];
  aspectRatio?: "square" | "portrait" | "video" | "auto";
  onClick?: () => void;
}

export function ImageCarousel({ images, aspectRatio = "auto", onClick }: ImageCarouselProps) {
  const N = images.length;
  const [currentIndex, setCurrentIndex] = useState(N > 1 ? 1 : 0);
  const [detectedRatio, setDetectedRatio] = useState<number | null>(null);
  
  // Drag / Swipe States
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // Detect aspect ratio of the first image to size the carousel perfectly
  useEffect(() => {
    if (images && images[0]) {
      const img = new Image();
      img.src = images[0];
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        setDetectedRatio(ratio);
      };
    }
  }, [images]);

  // Reset current index if images change
  useEffect(() => {
    setCurrentIndex(N > 1 ? 1 : 0);
  }, [images, N]);

  // Automatically re-enable transition after a snap jump
  useEffect(() => {
    if (!transitionEnabled) {
      const timer = setTimeout(() => {
        setTransitionEnabled(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [transitionEnabled]);

  if (!images || N === 0) return null;

  // Padded slides array for seamless infinite looping
  const slides = N > 1 ? [images[N - 1], ...images, images[0]] : images;

  // Swipe / Drag Handlers
  const handleStart = (clientX: number) => {
    if (N <= 1) return;
    setIsDragging(true);
    setStartX(clientX);
    setDragOffset(0);
    setTransitionEnabled(false);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || N <= 1) return;
    const diff = clientX - startX;
    setDragOffset(diff);
  };

  const handleEnd = () => {
    if (!isDragging || N <= 1) return;
    setIsDragging(false);
    setTransitionEnabled(true);

    const containerWidth = containerRef.current?.clientWidth || 300;
    const threshold = containerWidth * 0.18; // 18% of container width swipe threshold

    let nextIndex = currentIndex;
    if (dragOffset > threshold) {
      // Swiped right (previous slide)
      nextIndex = currentIndex - 1;
    } else if (dragOffset < -threshold) {
      // Swiped left (next slide)
      nextIndex = currentIndex + 1;
    }

    setCurrentIndex(nextIndex);
    setDragOffset(0);
  };

  // Mouse Gestures
  const onMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX);
  };

  const onMouseUpOrLeave = () => {
    handleEnd();
  };

  // Touch Gestures
  const onTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  const onTouchEnd = () => {
    handleEnd();
  };

  // Loop snap jump at edge boundaries
  const handleTransitionEnd = () => {
    if (N <= 1) return;
    
    if (currentIndex === 0) {
      setTransitionEnabled(false);
      setCurrentIndex(N);
    } else if (currentIndex === N + 1) {
      setTransitionEnabled(false);
      setCurrentIndex(1);
    }
  };

  // Build aspect-ratio style object to fit original image dimensions precisely
  const getAspectRatioStyle = () => {
    if (aspectRatio !== "auto") {
      switch (aspectRatio) {
        case "square":
          return { aspectRatio: "1 / 1" };
        case "portrait":
          return { aspectRatio: "4 / 5" };
        case "video":
          return { aspectRatio: "16 / 9" };
      }
    }
    if (detectedRatio) {
      return { aspectRatio: `${detectedRatio}` };
    }
    return { aspectRatio: "1 / 1" }; // Fallback to square
  };

  const getActiveDotIndex = () => {
    if (N <= 1) return 0;
    if (currentIndex === 0) return N - 1;
    if (currentIndex === N + 1) return 0;
    return currentIndex - 1;
  };

  const activeDotIndex = getActiveDotIndex();

  return (
    <div 
      ref={containerRef}
      style={getAspectRatioStyle()}
      className="relative rounded-xl overflow-hidden border border-buildops-border/40 bg-black/10 group select-none w-full"
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUpOrLeave}
      onMouseLeave={onMouseUpOrLeave}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Slides Wrapper */}
      <div 
        className="flex w-full h-full"
        style={{
          transform: `translate3d(calc(-${currentIndex * 100}% + ${dragOffset}px), 0px, 0px)`,
          transition: transitionEnabled ? "transform 350ms cubic-bezier(0.25, 1, 0.5, 1)" : "none",
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {slides.map((img, index) => (
          <div key={index} className="w-full h-full shrink-0 flex-none relative bg-neutral-950">
            <img
              src={img}
              alt={`Slide ${index}`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover select-none pointer-events-none"
            />
          </div>
        ))}
      </div>

      {/* Slide Navigation Controls & Indicators */}
      {N > 1 && (
        <>
          {/* Dots Indicator */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 bg-black/40 px-2 py-1 rounded-full">
            {images.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTransitionEnabled(true);
                  setCurrentIndex(index + 1);
                }}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                  activeDotIndex === index ? "bg-white scale-110" : "bg-white/40 hover:bg-white/60"
                }`}
              />
            ))}
          </div>

          {/* Slide Indicator Text */}
          <div className="absolute top-3 right-3 bg-black/60 px-2 py-0.5 rounded text-[11px] font-mono text-white/95 tracking-wider z-10">
            {activeDotIndex + 1}/{N}
          </div>
        </>
      )}
    </div>
  );
}
