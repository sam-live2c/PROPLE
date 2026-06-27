import { useState, useRef, useEffect } from "react";
import { X, Check, Move, ZoomIn } from "lucide-react";

interface ImageCropModalProps {
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedBase64: string) => void;
}

type AspectRatio = "1:1";

export function ImageCropModal({ imageSrc, onClose, onCropComplete }: ImageCropModalProps) {
  const [aspectRatio] = useState<AspectRatio>("1:1");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Calculate strict boundary constraints based on aspect ratio and zoom to avoid extra spaces
  const getConstrainedOffset = (x: number, y: number, currentZoom: number) => {
    const containerW = containerSize.width || 1;
    const containerH = containerSize.height || 1;
    if (!imageSize.width || !imageSize.height) return { x: 0, y: 0 };

    const imgRatio = imageSize.width / imageSize.height;
    const containerRatio = containerW / containerH;

    let renderedW = containerW;
    let renderedH = containerH;

    if (imgRatio > containerRatio) {
      // Image is wider than container - height matches container, width overflows
      renderedW = containerH * imgRatio;
    } else {
      // Image is taller than container - width matches container, height overflows
      renderedH = containerW / imgRatio;
    }

    // Zoom-adjusted size
    const finalRenderedW = renderedW * currentZoom;
    const finalRenderedH = renderedH * currentZoom;

    // Allowed movement bounds from center
    const limitX = Math.max(0, (finalRenderedW - containerW) / 2);
    const limitY = Math.max(0, (finalRenderedH - containerH) / 2);

    return {
      x: Math.min(Math.max(x, -limitX), limitX),
      y: Math.min(Math.max(y, -limitY), limitY),
    };
  };

  // Reset or constrain offsets when aspect ratio, zoom or image dimensions change
  useEffect(() => {
    setOffset(prev => getConstrainedOffset(prev.x, prev.y, zoom));
  }, [aspectRatio, zoom, containerSize, imageSize]);

  // Load image dimensions
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  // Measure container
  useEffect(() => {
    if (containerRef.current) {
      setContainerSize({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    }
    
    // Add resize observer to keep measured container size in sync
    if (containerRef.current) {
      const observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setContainerSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [aspectRatio]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    // Calculate new position
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    // Apply strict boundary constraints
    setOffset(getConstrainedOffset(newX, newY, zoom));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const newX = touch.clientX - dragStart.x;
    const newY = touch.clientY - dragStart.y;
    setOffset(getConstrainedOffset(newX, newY, zoom));
  };

  // Render crop using Canvas
  const handleApplyCrop = () => {
    if (!imageRef.current) return;

    const img = imageRef.current;
    const canvas = document.createElement("canvas");
    
    // Determine canvas output dimensions based on crop aspect ratio (forcing 1:1 square)
    const minSide = Math.min(imageSize.width || 1200, imageSize.height || 1200);
    let targetWidth = minSide;
    let targetHeight = minSide;

    // Cap at a standard, ultra-crisp 2048px (2K) to preserve absolute detail without exceeding payload limits
    const maxDimension = 2048;
    if (targetWidth > maxDimension || targetHeight > maxDimension) {
      const scale = maxDimension / Math.max(targetWidth, targetHeight);
      targetWidth = Math.round(targetWidth * scale);
      targetHeight = Math.round(targetHeight * scale);
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Draw background
    ctx.fillStyle = "#121214";
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Calculate scaling & translation from DOM to canvas coordinates
    // We need to map container space offsets and scale directly into canvas space
    const containerW = containerSize.width || 1;
    const containerH = containerSize.height || 1;

    // Scale mapping factor
    const canvasToDOMRatio = targetWidth / containerW;

    // In DOM, the image renders filled/fitted
    // Let's find the rendered dimensions of the image in the DOM container before any zoom/offset
    const imgRatio = imageSize.width / imageSize.height;
    const containerRatio = containerW / containerH;

    let renderedW = containerW;
    let renderedH = containerH;

    if (imgRatio > containerRatio) {
      // Image is wider than container - height matches container, width overflows
      renderedW = containerH * imgRatio;
    } else {
      // Image is taller than container - width matches container, height overflows
      renderedH = containerW / imgRatio;
    }

    // Zoom-adjusted size
    const finalRenderedW = renderedW * zoom;
    const finalRenderedH = renderedH * zoom;

    // Center offset of the image inside container
    const defaultX = (containerW - finalRenderedW) / 2;
    const defaultY = (containerH - finalRenderedH) / 2;

    // Add drag offsets
    const finalDOMX = defaultX + offset.x;
    const finalDOMY = defaultY + offset.y;

    // Draw on canvas
    ctx.drawImage(
      img,
      finalDOMX * canvasToDOMRatio,
      finalDOMY * canvasToDOMRatio,
      finalRenderedW * canvasToDOMRatio,
      finalRenderedH * canvasToDOMRatio
    );

    // Get final base64 string
    const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
    onCropComplete(croppedDataUrl);
  };

  // Get aspect ratio style class for container
  const getContainerAspectStyle = () => {
    return "aspect-square max-h-[380px] sm:max-h-[420px]";
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-buildops-bg border border-buildops-border/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-buildops-border/40 flex items-center justify-between bg-buildops-card/40">
          <h3 className="text-sm font-semibold tracking-wide uppercase font-mono text-buildops-text">
            Adjust Photograph
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-buildops-text-secondary hover:text-buildops-text transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Crop Container */}
        <div className="p-6 flex flex-col items-center justify-center bg-black/10 flex-1">
          <div
            ref={containerRef}
            className={`relative rounded-xl overflow-hidden border border-buildops-border/60 bg-black/40 w-full flex items-center justify-center select-none ${getContainerAspectStyle()}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
          >
            {/* Compass Grid/Guides for Alignment (Instagram style) */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 z-10 opacity-30">
              <div className="border-r border-b border-white/40"></div>
              <div className="border-r border-b border-white/40"></div>
              <div className="border-b border-white/40"></div>
              <div className="border-r border-b border-white/40"></div>
              <div className="border-r border-b border-white/40"></div>
              <div className="border-b border-white/40"></div>
              <div className="border-r border-white/40"></div>
              <div className="border-r border-white/40"></div>
              <div></div>
            </div>

            {/* Panning/Zooming Image */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop preview"
              onLoad={handleImageLoad}
              draggable={false}
              className="absolute max-w-none origin-center cursor-move transition-transform duration-75 select-none"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                width: imageSize.width && imageSize.height 
                  ? (imageSize.width / imageSize.height > (containerSize.width / containerSize.height || 1)
                      ? "auto" 
                      : "100%")
                  : "100%",
                height: imageSize.width && imageSize.height 
                  ? (imageSize.width / imageSize.height > (containerSize.width / containerSize.height || 1)
                      ? "100%" 
                      : "auto")
                  : "100%",
              }}
            />

            {/* Hint overlay */}
            <div className="absolute bottom-2.5 right-2.5 bg-black/60 px-2 py-0.5 rounded text-[10px] font-mono text-white/80 pointer-events-none flex items-center gap-1">
              <Move className="w-3 h-3" /> Drag to adjust position
            </div>
          </div>
        </div>

        {/* Controls Panel */}
        <div className="px-6 py-5 border-t border-buildops-border/40 bg-buildops-card/20 space-y-5">
          {/* Zoom Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-buildops-text-secondary">
              <span className="flex items-center gap-1"><ZoomIn className="w-3.5 h-3.5" /> Scale / Zoom</span>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-buildops-text-secondary">1x</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 h-1 bg-buildops-border rounded-lg appearance-none cursor-pointer accent-buildops-blue"
              />
              <span className="text-xs font-mono text-buildops-text-secondary">3x</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-buildops-border rounded-xl font-medium text-sm text-buildops-text-secondary hover:text-buildops-text hover:bg-white/5 transition-all cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              className="flex-1 py-2.5 bg-buildops-blue text-white rounded-xl font-medium text-sm hover:bg-buildops-blue/90 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-buildops-blue/10"
            >
              <Check className="w-4 h-4" /> Apply Adjustment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
