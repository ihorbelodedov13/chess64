import frame1 from "../assets/frame1.png";
import frame2 from "../assets/frame2.png";
import frame3 from "../assets/frame3.png";
import frame4 from "../assets/frame4.png";
import frame5 from "../assets/frame5.png";

export const FRAMES = [null, frame1, frame2, frame3, frame4, frame5];

export const FRAME_NAMES = [
  "Без рамки",
  "Розовое облако",
  "Водяное кольцо",
  "Фиолетовая энергия",
  "Красная ярость",
  "Пламя скелета",
];

interface Props {
  photoUrl?: string | null;
  firstName: string;
  lastName?: string | null;
  frame?: number;
  size?: number;
  className?: string;
  fallbackClassName?: string;
}

function getInitials(firstName: string, lastName?: string | null) {
  return ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() || "?";
}

export default function AvatarWithFrame({
  photoUrl,
  firstName,
  lastName,
  frame = 0,
  size = 80,
  className,
  fallbackClassName,
}: Props) {
  // Frame image is 480px for 300px avatar (90px padding each side)
  // Ratio: 480/300 = 1.6, offset = 90/300 = 0.3
  const frameSize = size * 1.6;
  const frameOffset = -(size * 0.3);
  const frameSrc = FRAMES[frame] ?? null;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={firstName}
          className={className}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <div
          className={fallbackClassName}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: fallbackClassName ? undefined : "linear-gradient(135deg, #FD9E0B, #EF4E05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size * 0.38,
            fontWeight: 700,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          {getInitials(firstName, lastName)}
        </div>
      )}

      {frameSrc && (
        <img
          src={frameSrc}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            width: frameSize,
            height: frameSize,
            top: frameOffset,
            left: frameOffset,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      )}
    </div>
  );
}
